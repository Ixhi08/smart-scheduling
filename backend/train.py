"""
Smart Scheduling — ML Training Pipeline

Trains and benchmarks 4 models:
  1. Random Forest
  2. XGBoost (Gradient Boosted Trees)
  3. K-Nearest Neighbors
  4. Feedforward Neural Network (MLPRegressor)

Saves:
  - best_model.joblib       (the winning model)
  - preprocessor.joblib     (the feature pipeline — needed at inference time)
  - benchmark_results.json  (MAE, RMSE, R² for all 4 models)
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.ensemble import RandomForestRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent
DATA_PATH   = BASE / "data" / "smart_scheduling_data.csv"
MODELS_DIR  = BASE / "models"
MODELS_DIR.mkdir(exist_ok=True)


# ── Load & split ───────────────────────────────────────────────────────────────
def load_data():
    df = pd.read_csv(DATA_PATH)
    X = df.drop(columns=["actual_duration_min"])
    y = df["actual_duration_min"]
    return train_test_split(X, y, test_size=0.2, random_state=42)


# ── Feature pipeline ───────────────────────────────────────────────────────────
CAT_FEATURES = ["visit_type", "insurance_type", "provider_type", "day_of_week"]
NUM_FEATURES = ["age", "num_conditions", "is_first_visit", "arrived_late_min", "complexity_score"]

def build_preprocessor():
    return ColumnTransformer(transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CAT_FEATURES),
        ("num", StandardScaler(), NUM_FEATURES),
    ])


# ── Model definitions ──────────────────────────────────────────────────────────
def get_models():
    return {
        "Random Forest": RandomForestRegressor(
            n_estimators=200, max_depth=12, min_samples_leaf=3,
            random_state=42, n_jobs=-1
        ),
        "XGBoost": XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, verbosity=0
        ),
        "KNN": KNeighborsRegressor(
            n_neighbors=8, weights="distance", metric="minkowski"
        ),
        "Neural Network": MLPRegressor(
            hidden_layer_sizes=(128, 64, 32), activation="relu",
            max_iter=500, random_state=42, early_stopping=True,
            validation_fraction=0.1, learning_rate_init=0.001
        ),
    }


# ── Metrics ────────────────────────────────────────────────────────────────────
def evaluate(name, pipeline, X_test, y_test):
    preds = pipeline.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)
    rmse  = np.sqrt(mean_squared_error(y_test, preds))
    r2    = r2_score(y_test, preds)
    print(f"  {name:<20}  MAE={mae:.2f}  RMSE={rmse:.2f}  R²={r2:.3f}")
    return {"mae": round(mae, 3), "rmse": round(rmse, 3), "r2": round(r2, 4)}


# ── Train ──────────────────────────────────────────────────────────────────────
def train():
    print("Loading data…")
    X_train, X_test, y_train, y_test = load_data()
    preprocessor = build_preprocessor()

    results = {}
    pipelines = {}

    print("\nTraining & evaluating models:")
    for name, model in get_models().items():
        pipe = Pipeline([("pre", preprocessor), ("model", model)])
        pipe.fit(X_train, y_train)
        metrics = evaluate(name, pipe, X_test, y_test)
        results[name] = metrics
        pipelines[name] = pipe

    # Pick best model by MAE
    best_name = min(results, key=lambda n: results[n]["mae"])
    print(f"\nBest model: {best_name} (MAE={results[best_name]['mae']})")

    # Save best model and preprocessor separately
    joblib.dump(pipelines[best_name], MODELS_DIR / "best_model.joblib")

    # Save standalone preprocessor fitted on training data
    pre_only = build_preprocessor()
    pre_only.fit(X_train)
    joblib.dump(pre_only, MODELS_DIR / "preprocessor.joblib")

    # Save benchmark results with model name tagged
    benchmark = {
        "best_model": best_name,
        "models": results,
        "feature_names": CAT_FEATURES + NUM_FEATURES,
        "visit_types": sorted(pd.read_csv(DATA_PATH)["visit_type"].unique().tolist()),
    }
    with open(MODELS_DIR / "benchmark_results.json", "w") as f:
        json.dump(benchmark, f, indent=2)

    print("Saved: best_model.joblib, preprocessor.joblib, benchmark_results.json")
    return benchmark


if __name__ == "__main__":
    train()
