"""
Smart Scheduling — training, calibration, and analytics pipeline.

Methodology
-----------
1. Stratified 60/20/20 train/calibration/final-test split by visit type.
2. Select the deployed model using 5-fold stratified CV on TRAIN only.
3. Fit candidates on TRAIN; model selection never uses calibration or final test.
4. Calibrate 90% Mondrian split-conformal intervals on CALIBRATION, using
   visit-type residual quantiles when groups are large enough and a global
   finite-sample conformal quantile as fallback.
5. Report final-test diagnostics only after model selection/calibration are fixed.
6. Audit subgroup error by insurance type even though insurance is explicitly
   excluded from model inputs.

Model-input audit
-----------------
The deployed model intentionally excludes:
- insurance_type: retained only as an audit attribute, not a scheduling input.
- arrived_late_min: operational simulation variable not known at booking time.
- any hand-coded complexity score: visit type already contains the relevant
  category information, avoiding a redundant target-informed proxy.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor
from data.generate import VISIT_TYPES

RANDOM_STATE = 42
CV_FOLDS = 5
CONFORMAL_ALPHA = 0.10
MIN_GROUP_CALIBRATION = 12
MIN_DURATION_MIN = 5.0
MAX_DURATION_MIN = 75.0

BASE = Path(__file__).parent
DATA_PATH = BASE / "data" / "smart_scheduling_data.csv"
MODELS_DIR = BASE / "models"
MODELS_DIR.mkdir(exist_ok=True)

CAT_FEATURES = ["visit_type", "provider_type", "day_of_week"]
NUM_FEATURES = ["age", "num_conditions", "is_first_visit"]
FEATURES = CAT_FEATURES + NUM_FEATURES
AUDIT_COLUMNS = ["insurance_type"]
EXCLUDED_MODEL_INPUTS = ["insurance_type", "arrived_late_min", "complexity_score"]
TARGET = "actual_duration_min"


def load_and_split_data():
    df = pd.read_csv(DATA_PATH)
    required = FEATURES + AUDIT_COLUMNS + ["arrived_late_min", TARGET]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    all_idx = np.arange(len(df))
    dev_idx, test_idx = train_test_split(
        all_idx,
        test_size=0.20,
        random_state=RANDOM_STATE,
        stratify=df["visit_type"],
    )
    train_idx, cal_idx = train_test_split(
        dev_idx,
        test_size=0.25,
        random_state=RANDOM_STATE,
        stratify=df.iloc[dev_idx]["visit_type"],
    )

    def X(idx):
        return df.iloc[idx][FEATURES].reset_index(drop=True)

    def y(idx):
        return df.iloc[idx][TARGET].astype(float).reset_index(drop=True)

    audit_test = df.iloc[test_idx][AUDIT_COLUMNS].reset_index(drop=True)
    return df, X(train_idx), X(cal_idx), X(test_idx), y(train_idx), y(cal_idx), y(test_idx), audit_test


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT_FEATURES),
            ("num", StandardScaler(), NUM_FEATURES),
        ]
    )


def get_models():
    return {
        "Random Forest": RandomForestRegressor(
            n_estimators=250,
            max_depth=12,
            min_samples_leaf=3,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=250,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=RANDOM_STATE,
            verbosity=0,
            n_jobs=-1,
        ),
        "KNN": KNeighborsRegressor(n_neighbors=8, weights="distance", metric="minkowski"),
        "Neural Network": MLPRegressor(
            hidden_layer_sizes=(128, 64, 32),
            activation="relu",
            max_iter=600,
            random_state=RANDOM_STATE,
            early_stopping=True,
            validation_fraction=0.1,
            learning_rate_init=0.001,
        ),
    }


def make_pipeline(model) -> Pipeline:
    return Pipeline([("pre", build_preprocessor()), ("model", model)])


def bounded_predict(pipeline: Pipeline, X: pd.DataFrame) -> np.ndarray:
    preds = np.asarray(pipeline.predict(X[FEATURES]), dtype=float)
    return np.clip(preds, MIN_DURATION_MIN, MAX_DURATION_MIN)


def regression_metrics(y_true, preds) -> dict:
    return {
        "mae": round(float(mean_absolute_error(y_true, preds)), 3),
        "rmse": round(float(math.sqrt(mean_squared_error(y_true, preds))), 3),
        "r2": round(float(r2_score(y_true, preds)), 4),
    }


def cv_metrics(name: str, pipeline: Pipeline, X_train, y_train, cv_splits) -> dict:
    scoring = {"mae": "neg_mean_absolute_error", "rmse": "neg_root_mean_squared_error", "r2": "r2"}
    scores = cross_validate(
        pipeline,
        X_train[FEATURES],
        y_train,
        cv=cv_splits,
        scoring=scoring,
        n_jobs=1,
        return_train_score=False,
    )
    mae = -scores["test_mae"]
    rmse = -scores["test_rmse"]
    r2 = scores["test_r2"]
    raw_mae_mean = float(np.mean(mae))
    result = {
        "cv_mae_mean": round(raw_mae_mean, 3),
        "cv_mae_std": round(float(np.std(mae, ddof=1)), 3),
        "cv_rmse_mean": round(float(np.mean(rmse)), 3),
        "cv_rmse_std": round(float(np.std(rmse, ddof=1)), 3),
        "cv_r2_mean": round(float(np.mean(r2)), 4),
        "cv_r2_std": round(float(np.std(r2, ddof=1)), 4),
        "_selection_mae_raw": raw_mae_mean,
    }
    print(
        f"  {name:<20} CV MAE={result['cv_mae_mean']:.3f} ± {result['cv_mae_std']:.3f}  "
        f"CV RMSE={result['cv_rmse_mean']:.3f}  CV R²={result['cv_r2_mean']:.4f}"
    )
    return result


def conformal_quantile(abs_residuals: np.ndarray, alpha: float) -> tuple[float, float, int]:
    scores = np.asarray(abs_residuals, dtype=float)
    if scores.ndim != 1 or len(scores) == 0:
        raise ValueError("Calibration residuals must be a non-empty 1D array")
    n = len(scores)
    rank = int(math.ceil((n + 1) * (1 - alpha)))
    q_level = min(rank / n, 1.0)
    qhat = float(np.quantile(scores, q_level, method="higher"))
    return qhat, q_level, rank


def make_reference_profile(X_train: pd.DataFrame) -> dict:
    profile: dict[str, object] = {}
    for col in CAT_FEATURES:
        profile[col] = str(X_train[col].mode(dropna=True).iloc[0])
    for col in NUM_FEATURES:
        val = float(X_train[col].median())
        if col in {"age", "num_conditions", "is_first_visit"}:
            val = int(round(val))
        profile[col] = val
    return profile


def _group_diagnostics(test_frame: pd.DataFrame, group_col: str, include_width: bool = False) -> list[dict]:
    out = []
    for group, g in test_frame.groupby(group_col, observed=True, sort=True):
        row = {
            "group": str(group),
            "count": int(len(g)),
            "mae": round(float(np.mean(np.abs(g["actual"] - g["predicted"]))), 3),
            "coverage": round(float(g["covered"].mean()), 4),
        }
        if include_width:
            row["avg_interval_width"] = round(float(g["width"].mean()), 3)
        out.append(row)
    return out


def make_analytics(
    best_pipeline: Pipeline,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    audit_test: pd.DataFrame,
    preds: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
    qhat_by_type: dict[str, float],
) -> dict:
    y_np = y_test.to_numpy(dtype=float)
    residuals = y_np - preds
    abs_err = np.abs(residuals)
    covered = (y_np >= lower) & (y_np <= upper)

    perm = permutation_importance(
        best_pipeline,
        X_test[FEATURES],
        y_test,
        scoring="neg_mean_absolute_error",
        n_repeats=8,
        random_state=RANDOM_STATE,
        n_jobs=1,
    )
    feature_importance = sorted(
        [
            {
                "feature": feature,
                "importance_mean": round(float(mean), 4),
                "importance_std": round(float(std), 4),
            }
            for feature, mean, std in zip(FEATURES, perm.importances_mean, perm.importances_std)
        ],
        key=lambda x: x["importance_mean"],
        reverse=True,
    )

    test_frame = X_test.copy().reset_index(drop=True)
    for col in AUDIT_COLUMNS:
        test_frame[col] = audit_test[col].values
    test_frame["actual"] = y_np
    test_frame["predicted"] = preds
    test_frame["covered"] = covered
    test_frame["width"] = upper - lower

    test_points = []
    for idx, row in test_frame.iterrows():
        test_points.append(
            {
                "actual": round(float(row["actual"]), 2),
                "predicted": round(float(row["predicted"]), 2),
                "residual": round(float(row["actual"] - row["predicted"]), 2),
                "abs_error": round(float(abs(row["actual"] - row["predicted"])), 2),
                "lower": round(float(lower[idx]), 2),
                "upper": round(float(upper[idx]), 2),
                "covered": bool(covered[idx]),
                "visit_type": str(row["visit_type"]),
                "age": int(row["age"]),
            }
        )

    by_visit_type = _group_diagnostics(test_frame, "visit_type", include_width=True)
    for row in by_visit_type:
        row["qhat_min"] = round(float(qhat_by_type[row["group"]]), 3) if row["group"] in qhat_by_type else None

    age_labels = ["<18", "18–39", "40–59", "60–79", "80+"]
    age_bins = [-np.inf, 17, 39, 59, 79, np.inf]
    test_frame["age_group"] = pd.cut(test_frame["age"], bins=age_bins, labels=age_labels)
    by_age_group = _group_diagnostics(test_frame, "age_group")
    by_insurance_type = _group_diagnostics(test_frame, "insurance_type")

    insurance_maes = [x["mae"] for x in by_insurance_type if x["count"] >= 10]
    insurance_mae_gap = round(max(insurance_maes) - min(insurance_maes), 3) if len(insurance_maes) >= 2 else None

    counts, edges = np.histogram(residuals, bins=12)
    residual_histogram = [
        {"bin_start": round(float(edges[i]), 2), "bin_end": round(float(edges[i + 1]), 2), "count": int(counts[i])}
        for i in range(len(counts))
    ]

    return {
        "feature_importance": feature_importance,
        "test_points": test_points,
        "error_by_visit_type": by_visit_type,
        "error_by_age_group": by_age_group,
        "error_by_insurance_type": by_insurance_type,
        "insurance_mae_gap_min": insurance_mae_gap,
        "subgroup_audit_note": "Insurance type is excluded from model inputs and is used only for synthetic subgroup error auditing.",
        "residual_histogram": residual_histogram,
    }


def train():
    print("Loading data and creating stratified 60/20/20 split…")
    df, X_train, X_cal, X_test, y_train, y_cal, y_test, audit_test = load_and_split_data()
    print(f"Rows: train={len(X_train)}, calibration={len(X_cal)}, test={len(X_test)} (total={len(df)})")

    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    cv_splits = list(skf.split(X_train, X_train["visit_type"]))

    results: dict[str, dict] = {}
    fitted_pipelines: dict[str, Pipeline] = {}
    selection_scores: dict[str, float] = {}

    print("\nModel selection using 5-fold stratified CV on TRAIN only:")
    for name, estimator in get_models().items():
        pipe = make_pipeline(estimator)
        cv_result = cv_metrics(name, pipe, X_train, y_train, cv_splits)
        selection_scores[name] = float(cv_result.pop("_selection_mae_raw"))
        pipe.fit(X_train[FEATURES], y_train)
        test_preds = bounded_predict(pipe, X_test)
        test_result = regression_metrics(y_test, test_preds)
        results[name] = {
            **test_result,
            **cv_result,
            "test_mae": test_result["mae"],
            "test_rmse": test_result["rmse"],
            "test_r2": test_result["r2"],
        }
        fitted_pipelines[name] = pipe

    best_name = min(selection_scores, key=selection_scores.get)
    best_pipeline = fitted_pipelines[best_name]
    print(f"\nSelected model: {best_name} by CV MAE")

    cal_preds = bounded_predict(best_pipeline, X_cal)
    cal_y = y_cal.to_numpy(dtype=float)
    cal_scores = np.abs(cal_y - cal_preds)
    global_qhat, q_level, rank = conformal_quantile(cal_scores, CONFORMAL_ALPHA)

    qhat_by_type: dict[str, float] = {}
    group_sizes: dict[str, int] = {}
    cal_types = X_cal["visit_type"].astype(str).to_numpy()
    for visit_type in sorted(df["visit_type"].astype(str).unique()):
        mask = cal_types == visit_type
        n_group = int(mask.sum())
        group_sizes[visit_type] = n_group
        if n_group >= MIN_GROUP_CALIBRATION:
            group_qhat, _, _ = conformal_quantile(cal_scores[mask], CONFORMAL_ALPHA)
            qhat_by_type[visit_type] = float(group_qhat)

    test_preds = bounded_predict(best_pipeline, X_test)
    test_types = X_test["visit_type"].astype(str).to_numpy()
    test_qhats = np.array([qhat_by_type.get(t, global_qhat) for t in test_types], dtype=float)
    lower = np.clip(test_preds - test_qhats, MIN_DURATION_MIN, MAX_DURATION_MIN)
    upper = np.clip(test_preds + test_qhats, MIN_DURATION_MIN, MAX_DURATION_MIN)
    y_test_np = y_test.to_numpy(dtype=float)
    covered = (y_test_np >= lower) & (y_test_np <= upper)
    widths = upper - lower

    group_qhat_values = np.array(list(qhat_by_type.values()) or [global_qhat], dtype=float)
    uncertainty_thresholds = {
        "low_max_qhat_min": round(float(np.quantile(group_qhat_values, 1 / 3)), 3),
        "moderate_max_qhat_min": round(float(np.quantile(group_qhat_values, 2 / 3)), 3),
    }

    conformal = {
        "method": "mondrian_split_conformal_absolute_residual",
        "grouping": "visit_type with global fallback",
        "alpha": CONFORMAL_ALPHA,
        "nominal_coverage": round(1 - CONFORMAL_ALPHA, 3),
        "calibration_size": int(len(X_cal)),
        "minimum_group_calibration": MIN_GROUP_CALIBRATION,
        "quantile_rank": rank,
        "quantile_level": round(q_level, 6),
        "global_qhat_min": round(float(global_qhat), 4),
        "qhat_min": round(float(global_qhat), 4),
        "qhat_by_visit_type": {k: round(v, 4) for k, v in qhat_by_type.items()},
        "calibration_group_sizes": group_sizes,
        "uncertainty_thresholds": uncertainty_thresholds,
        "test_empirical_coverage": round(float(np.mean(covered)), 4),
        "test_avg_interval_width_min": round(float(np.mean(widths)), 3),
        "test_median_interval_width_min": round(float(np.median(widths)), 3),
    }

    analytics = make_analytics(
        best_pipeline, X_test, y_test, audit_test, test_preds, lower, upper, qhat_by_type
    )
    reference_profile = make_reference_profile(X_train)

    joblib.dump(best_pipeline, MODELS_DIR / "best_model.joblib")
    joblib.dump(best_pipeline.named_steps["pre"], MODELS_DIR / "preprocessor.joblib")

    benchmark = {
        "best_model": best_name,
        "selection": {
            "method": "5-fold stratified cross-validation on training split",
            "selection_metric": "mean absolute error",
            "cv_folds": CV_FOLDS,
            "selected_cv_mae": results[best_name]["cv_mae_mean"],
        },
        "split": {
            "random_state": RANDOM_STATE,
            "train_size": int(len(X_train)),
            "calibration_size": int(len(X_cal)),
            "test_size": int(len(X_test)),
            "train_fraction": round(len(X_train) / len(df), 3),
            "calibration_fraction": round(len(X_cal) / len(df), 3),
            "test_fraction": round(len(X_test) / len(df), 3),
        },
        "models": results,
        "conformal": conformal,
        "analytics": analytics,
        "reference_profile": reference_profile,
        "feature_names": FEATURES,
        "excluded_model_inputs": EXCLUDED_MODEL_INPUTS,
        "audit_attributes": AUDIT_COLUMNS,
        "visit_types": sorted(df["visit_type"].astype(str).unique().tolist()),
        "visit_type_age_ranges": {name: [int(spec[2]), int(spec[3])] for name, spec in VISIT_TYPES.items()},
        "duration_bounds_min": [MIN_DURATION_MIN, MAX_DURATION_MIN],
        "data_note": (
            "Synthetic research/engineering dataset. Per-visit-type durations and feature effects are explicit simulation assumptions, "
            "not clinically estimated coefficients."
        ),
    }

    with open(MODELS_DIR / "benchmark_results.json", "w") as f:
        json.dump(benchmark, f, indent=2)

    print("\nConformal calibration:")
    print(f"  Global q-hat: {global_qhat:.3f} min")
    print(f"  Visit-type q-hats: {len(qhat_by_type)} / {df['visit_type'].nunique()} groups")
    print(f"  Test coverage: {100 * conformal['test_empirical_coverage']:.1f}%")
    print(f"  Avg interval width: {conformal['test_avg_interval_width_min']:.2f} min")
    print("Model inputs:", ", ".join(FEATURES))
    print("Explicitly excluded:", ", ".join(EXCLUDED_MODEL_INPUTS))
    print("Saved: best_model.joblib, preprocessor.joblib, benchmark_results.json")
    return benchmark


if __name__ == "__main__":
    train()
