"""Smart Scheduling — FastAPI backend (v4).

Endpoints
---------
POST /predict      point prediction + calibrated Mondrian conformal interval
POST /explain      local sequential sensitivity + batched what-if curves
GET  /benchmark    model-selection, holdout, calibration, and analytics data
POST /simulate     corrected pre-booked clinic simulation + slot optimizer
GET  /visit-types  input categories + scenario presets
GET  /health       health check
"""

from __future__ import annotations

import copy
import json
import math
import os
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE = Path(__file__).parent
MODEL_PATH = BASE / "models" / "best_model.joblib"
BENCHMARK_PATH = BASE / "models" / "benchmark_results.json"

model = joblib.load(MODEL_PATH)
benchmark = json.loads(BENCHMARK_PATH.read_text())

CONFORMAL = benchmark["conformal"]
GLOBAL_QHAT_MIN = float(CONFORMAL.get("global_qhat_min", CONFORMAL.get("qhat_min", 5.0)))
QHAT_BY_TYPE = {k: float(v) for k, v in CONFORMAL.get("qhat_by_visit_type", {}).items()}
INTERVAL_LEVEL = float(CONFORMAL["nominal_coverage"])
EMPIRICAL_COVERAGE = float(CONFORMAL["test_empirical_coverage"])
UNCERTAINTY_THRESHOLDS = CONFORMAL.get(
    "uncertainty_thresholds",
    {"low_max_qhat_min": GLOBAL_QHAT_MIN, "moderate_max_qhat_min": GLOBAL_QHAT_MIN},
)
MIN_DURATION_MIN, MAX_DURATION_MIN = map(float, benchmark.get("duration_bounds_min", [5.0, 75.0]))
SLOT_INCREMENT_MIN = 5
TRADITIONAL_SLOT_MIN = 20.0

app = FastAPI(title="Smart Scheduling API", version="4.1")
_default_origins = "http://localhost:3000,https://smart-scheduling-ai.vercel.app"
_allowed_origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class PatientInput(BaseModel):
    visit_type: str = Field(..., examples=["Hypertension Follow-up"])
    age: int = Field(..., ge=1, le=110, examples=[58])
    provider_type: str = Field(..., examples=["MD"])
    day_of_week: str = Field(..., examples=["Monday"])
    num_conditions: int = Field(0, ge=0, le=4, examples=[2])
    is_first_visit: int = Field(0, ge=0, le=1, examples=[0])


class SimulationRequest(BaseModel):
    n_patients: int = Field(16, ge=5, le=30)
    seed: int = Field(42, ge=0)
    preset: str = Field("Primary Care")
    clinic_start_hour: float = Field(8.0, ge=0, le=23.5)
    clinic_end_hour: float = Field(17.0, ge=0.5, le=24.0)
    lunch_start_hour: float = Field(12.0, ge=0, le=23.5)
    lunch_duration_min: int = Field(60, ge=0, le=180)
    closing_buffer_min: int = Field(30, ge=0, le=120)
    allow_reordering: bool = True


PROVIDER_TYPES = ["MD", "DO", "NP", "PA"]
DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

FEATURE_LABELS = {
    "visit_type": "Visit type",
    "age": "Age",
    "provider_type": "Provider type",
    "day_of_week": "Day of week",
    "num_conditions": "Chronic conditions",
    "is_first_visit": "First visit",
}


EXPLANATION_ORDER = [
    "visit_type",
    "age",
    "provider_type",
    "day_of_week",
    "num_conditions",
    "is_first_visit",
]


def _validate_categories(patient: PatientInput) -> None:
    checks = [
        (patient.visit_type, set(benchmark["visit_types"]), "visit_type"),
        (patient.provider_type, set(PROVIDER_TYPES), "provider_type"),
        (patient.day_of_week, set(DAYS_OF_WEEK), "day_of_week"),
    ]
    for value, allowed, field_name in checks:
        if value not in allowed:
            raise HTTPException(status_code=422, detail=f"Invalid {field_name}: {value!r}")

    age_range = benchmark.get("visit_type_age_ranges", {}).get(patient.visit_type)
    if age_range is not None:
        lo, hi = map(int, age_range)
        if not (lo <= patient.age <= hi):
            raise HTTPException(
                status_code=422,
                detail=f"Age {patient.age} is outside the synthetic training range for {patient.visit_type!r} ({lo}-{hi}).",
            )


def _patient_row(patient: PatientInput) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "visit_type": patient.visit_type,
                "age": patient.age,
                "provider_type": patient.provider_type,
                "day_of_week": patient.day_of_week,
                "num_conditions": patient.num_conditions,
                "is_first_visit": patient.is_first_visit,
            }
        ]
    )


def _dict_row(values: dict) -> pd.DataFrame:
    return pd.DataFrame([values])


def _bounded_prediction(row: pd.DataFrame) -> float:
    raw = float(model.predict(row)[0])
    return float(np.clip(raw, MIN_DURATION_MIN, MAX_DURATION_MIN))


def _qhat_for_visit_type(visit_type: str) -> float:
    return float(QHAT_BY_TYPE.get(visit_type, GLOBAL_QHAT_MIN))


def _uncertainty_level(qhat: float) -> str:
    low = float(UNCERTAINTY_THRESHOLDS["low_max_qhat_min"])
    moderate = float(UNCERTAINTY_THRESHOLDS["moderate_max_qhat_min"])
    if qhat <= low:
        return "Low"
    if qhat <= moderate:
        return "Moderate"
    return "Higher"


def _round_up_to_increment(value: float, increment: int = SLOT_INCREMENT_MIN) -> int:
    rounded = int(math.ceil(value / increment) * increment)
    return int(np.clip(rounded, MIN_DURATION_MIN, MAX_DURATION_MIN))


def _predict_core(patient: PatientInput) -> dict:
    _validate_categories(patient)
    prediction = _bounded_prediction(_patient_row(patient))
    qhat = _qhat_for_visit_type(patient.visit_type)
    lower = max(MIN_DURATION_MIN, prediction - qhat)
    upper = min(MAX_DURATION_MIN, prediction + qhat)
    recommended_slot = _round_up_to_increment(upper)
    slot_adjustment = recommended_slot - TRADITIONAL_SLOT_MIN
    interval = [round(lower, 1), round(upper, 1)]
    return {
        "predicted_duration_min": round(prediction, 1),
        "recommended_slot_min": recommended_slot,
        "prediction_interval": interval,
        "confidence_interval": interval,
        "interval_level": INTERVAL_LEVEL,
        "interval_width_min": round(upper - lower, 1),
        "conformal_qhat_min": round(qhat, 3),
        "uncertainty_level": _uncertainty_level(qhat),
        "empirical_coverage": EMPIRICAL_COVERAGE,
        "traditional_slot_min": TRADITIONAL_SLOT_MIN,
        "slot_adjustment_min": round(slot_adjustment, 1),
        "time_saved_min": round(max(0.0, TRADITIONAL_SLOT_MIN - recommended_slot), 1),
        "time_saved_pct": round(max(0.0, TRADITIONAL_SLOT_MIN - recommended_slot) / TRADITIONAL_SLOT_MIN * 100, 1),
        "model_used": benchmark["best_model"],
        "recommended_slot_basis": "visit-type conformal upper bound rounded up to 5 minutes",
    }


def _format_feature_value(key: str, value) -> str:
    if key == "is_first_visit":
        return "New patient" if int(value) == 1 else "Returning patient"
    if key == "num_conditions":
        return f"{int(value)}"
    if key == "age":
        return str(int(value))
    return str(value)


def _local_sequential_explanation(patient: PatientInput) -> dict:
    """Path-based local sensitivity explanation.

    This is intentionally NOT labeled SHAP. Starting from a reference patient,
    features are changed one at a time in a fixed documented order; each impact
    is the model change caused by that step. Impacts therefore sum exactly to the
    difference between reference and final prediction, but are order-dependent.
    """
    reference = copy.deepcopy(benchmark.get("reference_profile", {}))
    if not reference:
        reference = {
            "visit_type": "Hypertension Follow-up",
            "provider_type": "MD",
            "day_of_week": "Wednesday",
            "age": 40,
            "num_conditions": 1,
            "is_first_visit": 0,
        }

    # Normalize reference types for the pipeline.
    current = {
        "visit_type": str(reference["visit_type"]),
        "provider_type": str(reference["provider_type"]),
        "day_of_week": str(reference["day_of_week"]),
        "age": int(reference["age"]),
        "num_conditions": int(reference["num_conditions"]),
        "is_first_visit": int(reference["is_first_visit"]),
    }
    baseline_prediction = _bounded_prediction(_dict_row(current))
    previous_prediction = baseline_prediction
    contributions = []

    patient_values = patient.model_dump()
    for key in EXPLANATION_ORDER:
        current[key] = patient_values[key]
        new_prediction = _bounded_prediction(_dict_row(current))
        impact = new_prediction - previous_prediction
        contributions.append(
            {
                "feature": key,
                "label": FEATURE_LABELS[key],
                "value": _format_feature_value(key, patient_values[key]),
                "impact_min": round(float(impact), 2),
                "direction": "longer" if impact > 0.05 else "shorter" if impact < -0.05 else "neutral",
            }
        )
        previous_prediction = new_prediction


    contributions.sort(key=lambda c: abs(c["impact_min"]), reverse=True)
    return {
        "method": "sequential local sensitivity from training-set reference profile",
        "warning": "Impacts are path-dependent sensitivity estimates, not SHAP values or causal effects.",
        "reference_profile": reference,
        "baseline_prediction_min": round(float(baseline_prediction), 2),
        "final_prediction_min": round(float(previous_prediction), 2),
        "total_delta_min": round(float(previous_prediction - baseline_prediction), 2),
        "contributions": contributions,
    }


def _scenario_prediction(patient: PatientInput, **overrides) -> dict:
    data = patient.model_dump()
    data.update(overrides)
    p = PatientInput(**data)
    result = _predict_core(p)
    return {
        "predicted_duration_min": result["predicted_duration_min"],
        "lower": result["prediction_interval"][0],
        "upper": result["prediction_interval"][1],
    }


def _what_if(patient: PatientInput) -> dict:
    conditions = []
    for value in [0, 1, 2, 3, 4]:
        conditions.append({"x": value, **_scenario_prediction(patient, num_conditions=value)})

    current_age = int(patient.age)
    age_lo, age_hi = benchmark.get("visit_type_age_ranges", {}).get(patient.visit_type, [1, 110])
    age_lo, age_hi = int(age_lo), int(age_hi)
    candidate_ages = {
        age_lo,
        age_hi,
        current_age,
        max(age_lo, current_age - 20),
        max(age_lo, current_age - 10),
        min(age_hi, current_age + 10),
        min(age_hi, current_age + 20),
    }
    age_values = sorted(v for v in candidate_ages if age_lo <= v <= age_hi)
    ages = [{"x": value, **_scenario_prediction(patient, age=value)} for value in age_values]

    first_visit = [
        {"x": "Returning", **_scenario_prediction(patient, is_first_visit=0)},
        {"x": "First visit", **_scenario_prediction(patient, is_first_visit=1)},
    ]

    day_of_week = [
        {"x": day, **_scenario_prediction(patient, day_of_week=day)}
        for day in DAYS_OF_WEEK
    ]

    return {
        "num_conditions": conditions,
        "age": ages,
        "first_visit": first_visit,
        "day_of_week": day_of_week,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": benchmark["best_model"],
        "interval_level": INTERVAL_LEVEL,
        "api_version": app.version,
    }


@app.get("/visit-types")
def visit_types():
    from simulate import SCENARIO_PRESETS

    return {
        "visit_types": benchmark["visit_types"],
        "visit_type_age_ranges": benchmark.get("visit_type_age_ranges", {}),
        "provider_types": PROVIDER_TYPES,
        "days_of_week": DAYS_OF_WEEK,
        "scenario_presets": list(SCENARIO_PRESETS.keys()),
    }


@app.get("/benchmark")
def get_benchmark():
    return benchmark


@app.post("/predict")
def predict(patient: PatientInput):
    return _predict_core(patient)


@app.post("/explain")
def explain(patient: PatientInput):
    return {
        "prediction": _predict_core(patient),
        "explanation": _local_sequential_explanation(patient),
        "what_if": _what_if(patient),
    }


@app.post("/simulate")
def simulate(req: SimulationRequest):
    from simulate import SCENARIO_PRESETS, run_simulation

    if req.preset not in SCENARIO_PRESETS:
        raise HTTPException(status_code=422, detail=f"Unknown preset: {req.preset!r}")
    if req.clinic_end_hour <= req.clinic_start_hour:
        raise HTTPException(status_code=422, detail="Clinic end must be after clinic start")

    clinic_start = int(round(req.clinic_start_hour * 60))
    clinic_end = int(round(req.clinic_end_hour * 60))
    lunch_start = int(round(req.lunch_start_hour * 60))

    try:
        return run_simulation(
            n_patients=req.n_patients,
            seed=req.seed,
            preset=req.preset,
            clinic_start=clinic_start,
            clinic_end=clinic_end,
            lunch_start=lunch_start,
            lunch_duration=req.lunch_duration_min,
            closing_buffer=req.closing_buffer_min,
            allow_reordering=req.allow_reordering,
            model=model,
            benchmark=benchmark,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
