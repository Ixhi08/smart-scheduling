"""
Smart Scheduling — FastAPI Backend

Endpoints:
  POST /predict         → appointment duration prediction for one patient
  GET  /benchmark       → model comparison results (MAE, RMSE, R²)
  POST /simulate        → full clinic day simulation
  GET  /visit-types     → list of valid visit types for frontend dropdowns
  GET  /health          → health check
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE           = Path(__file__).parent
MODEL_PATH     = BASE / "models" / "best_model.joblib"
BENCHMARK_PATH = BASE / "models" / "benchmark_results.json"

# ── Load model & benchmark at startup ─────────────────────────────────────────
model     = joblib.load(MODEL_PATH)
benchmark = json.loads(BENCHMARK_PATH.read_text())

app = FastAPI(title="Smart Scheduling API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ────────────────────────────────────────────────────────────────────
class PatientInput(BaseModel):
    visit_type:        str   = Field(..., example="Hypertension Follow-up")
    age:               int   = Field(..., ge=1, le=110, example=58)
    insurance_type:    str   = Field(..., example="Medicare")
    provider_type:     str   = Field(..., example="MD")
    day_of_week:       str   = Field(..., example="Monday")
    num_conditions:    int   = Field(0, ge=0, le=10, example=2)
    is_first_visit:    int   = Field(0, ge=0, le=1, example=0)
    arrived_late_min:  float = Field(0.0, ge=0, le=60, example=0.0)
    complexity_score:  Optional[float] = None  # inferred from visit_type if omitted


class SimulationRequest(BaseModel):
    n_patients: int = Field(15, ge=5, le=30)
    seed:       int = Field(42, ge=0)


# ── Complexity map (for frontend convenience — inferred automatically) ─────────
COMPLEXITY_MAP = {
    "Upper Respiratory Infection":    0.2,
    "Hypertension Follow-up":         0.7,
    "Type 2 Diabetes Management":     0.9,
    "Annual Wellness Exam":           0.8,
    "Acute Back Pain":                0.5,
    "Anxiety / Depression Follow-up": 0.7,
    "Minor Laceration / Wound Care":  0.3,
    "Urinary Tract Infection":        0.2,
    "Chest Pain Evaluation":          1.0,
    "Pediatric Well Visit":           0.5,
    "Asthma Management":              0.6,
    "Skin Rash / Dermatology":        0.3,
    "Knee / Joint Pain":              0.5,
    "Medication Refill Only":         0.1,
    "New Patient Intake":             1.0,
}


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": benchmark["best_model"]}


@app.get("/visit-types")
def visit_types():
    return {
        "visit_types":    benchmark["visit_types"],
        "insurance_types": ["Private", "Medicare", "Medicaid", "Uninsured"],
        "provider_types":  ["MD", "DO", "NP", "PA"],
        "days_of_week":    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    }


@app.get("/benchmark")
def get_benchmark():
    return benchmark


@app.post("/predict")
def predict(patient: PatientInput):
    complexity = patient.complexity_score
    if complexity is None:
        complexity = COMPLEXITY_MAP.get(patient.visit_type, 0.5)

    row = pd.DataFrame([{
        "visit_type":       patient.visit_type,
        "age":              patient.age,
        "insurance_type":   patient.insurance_type,
        "provider_type":    patient.provider_type,
        "day_of_week":      patient.day_of_week,
        "num_conditions":   patient.num_conditions,
        "is_first_visit":   patient.is_first_visit,
        "arrived_late_min": patient.arrived_late_min,
        "complexity_score": complexity,
    }])

    prediction = float(model.predict(row)[0])
    prediction = max(5.0, min(75.0, prediction))

    # Confidence interval: ±1 MAE from benchmark
    mae = benchmark["models"][benchmark["best_model"]]["mae"]
    buffered = prediction * 1.15

    traditional_slot = 20.0
    time_saved_min = max(0.0, traditional_slot - buffered)
    time_saved_pct = round(time_saved_min / traditional_slot * 100, 1)

    return {
        "predicted_duration_min":  round(prediction, 1),
        "recommended_slot_min":    round(buffered, 1),
        "confidence_interval":     [round(prediction - mae, 1), round(prediction + mae, 1)],
        "traditional_slot_min":    traditional_slot,
        "time_saved_min":          round(time_saved_min, 1),
        "time_saved_pct":          time_saved_pct,
        "model_used":              benchmark["best_model"],
        "complexity_score":        round(complexity, 2),
    }


@app.post("/simulate")
def simulate(req: SimulationRequest):
    from simulate import run_simulation
    try:
        result = run_simulation(n_patients=req.n_patients, seed=req.seed)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
