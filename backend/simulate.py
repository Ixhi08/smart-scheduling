"""
Smart Scheduling — Clinic Day Simulation

Discrete-event simulation comparing two scheduling strategies:
  1. Fixed slots (traditional): every appointment gets 20 minutes
  2. AI-predicted slots: appointment length = model prediction + 15% buffer

Outputs per-appointment timeline and aggregate stats for both strategies.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

BASE        = Path(__file__).parent
MODEL_PATH  = BASE / "models" / "best_model.joblib"
DATA_PATH   = BASE / "data" / "smart_scheduling_data.csv"

FIXED_SLOT_MIN   = 20      # traditional fixed slot length
BUFFER_PCT       = 0.15    # AI adds 15% buffer on top of prediction
CLINIC_START_MIN = 8 * 60  # 8:00 AM in minutes from midnight
CLINIC_END_MIN   = 17 * 60 # 5:00 PM


def load_model():
    return joblib.load(MODEL_PATH)


def sample_patients(n: int = 15, seed: int = 99) -> pd.DataFrame:
    """Sample n patients from the dataset to simulate a clinic day."""
    df = pd.read_csv(DATA_PATH)
    return df.sample(n=n, random_state=seed).reset_index(drop=True)


def simulate_day(patients: pd.DataFrame, model) -> dict:
    """
    Run both scheduling strategies on the same patient set.
    Returns dict with per-appointment data and aggregate stats.
    """
    # Get AI predictions for all patients
    feature_cols = [
        "visit_type", "insurance_type", "provider_type", "day_of_week",
        "age", "num_conditions", "is_first_visit", "arrived_late_min", "complexity_score"
    ]
    X = patients[feature_cols]
    predictions = model.predict(X)
    ai_slots = np.ceil(predictions * (1 + BUFFER_PCT)).astype(int)

    actual_durations = patients["actual_duration_min"].values

    # ── Strategy 1: Fixed slots ────────────────────────────────────────────────
    fixed_results = []
    fixed_clock = CLINIC_START_MIN

    for i, row in patients.iterrows():
        scheduled_start = fixed_clock
        actual_start    = scheduled_start + max(0, row["arrived_late_min"])
        actual_end      = actual_start + actual_durations[i]
        wait_time       = max(0.0, actual_start - scheduled_start)
        slot_end        = scheduled_start + FIXED_SLOT_MIN
        # If appointment runs over, next patient is pushed
        fixed_clock     = max(slot_end, actual_end)

        fixed_results.append({
            "patient_idx":      i,
            "visit_type":       row["visit_type"],
            "scheduled_start":  scheduled_start,
            "actual_start":     actual_start,
            "actual_end":       actual_end,
            "slot_length":      FIXED_SLOT_MIN,
            "actual_duration":  round(actual_durations[i], 1),
            "wait_time":        round(wait_time, 1),
            "idle_time":        round(max(0.0, actual_start - slot_end), 1),
            "overtime":         round(max(0.0, actual_end - slot_end), 1),
        })

    # ── Strategy 2: AI-predicted slots ────────────────────────────────────────
    ai_results = []
    ai_clock = CLINIC_START_MIN

    for i, row in patients.iterrows():
        scheduled_start = ai_clock
        actual_start    = scheduled_start + max(0, row["arrived_late_min"])
        actual_end      = actual_start + actual_durations[i]
        wait_time       = max(0.0, actual_start - scheduled_start)
        slot_end        = scheduled_start + int(ai_slots[i])
        ai_clock        = max(slot_end, actual_end)

        ai_results.append({
            "patient_idx":      i,
            "visit_type":       row["visit_type"],
            "scheduled_start":  scheduled_start,
            "actual_start":     actual_start,
            "actual_end":       actual_end,
            "slot_length":      int(ai_slots[i]),
            "predicted_duration": round(float(predictions[i]), 1),
            "actual_duration":  round(actual_durations[i], 1),
            "wait_time":        round(wait_time, 1),
            "idle_time":        round(max(0.0, actual_start - slot_end), 1),
            "overtime":         round(max(0.0, actual_end - slot_end), 1),
        })

    # ── Aggregate stats ────────────────────────────────────────────────────────
    def aggregate(results, clock):
        waits    = [r["wait_time"] for r in results]
        idles    = [r["idle_time"] for r in results]
        overtime = [r["overtime"]  for r in results]
        total_scheduled = sum(r["slot_length"] for r in results)
        clinic_end_actual = clock
        clinic_duration   = clinic_end_actual - CLINIC_START_MIN
        return {
            "avg_wait_min":        round(np.mean(waits), 1),
            "max_wait_min":        round(np.max(waits), 1),
            "total_idle_min":      round(sum(idles), 1),
            "total_overtime_min":  round(sum(overtime), 1),
            "total_scheduled_min": total_scheduled,
            "clinic_end_min":      round(clinic_end_actual, 1),
            "clinic_duration_min": round(clinic_duration, 1),
            "patients_seen":       len(results),
        }

    fixed_agg = aggregate(fixed_results, fixed_clock)
    ai_agg    = aggregate(ai_results, ai_clock)

    # Time saved = difference in total scheduled time
    time_saved_pct = round(
        (fixed_agg["total_scheduled_min"] - ai_agg["total_scheduled_min"])
        / fixed_agg["total_scheduled_min"] * 100, 1
    )

    return {
        "fixed":          {"appointments": fixed_results,  "aggregate": fixed_agg},
        "ai":             {"appointments": ai_results,     "aggregate": ai_agg},
        "time_saved_pct": time_saved_pct,
        "num_patients":   len(patients),
    }


def run_simulation(n_patients: int = 15, seed: int = 99) -> dict:
    model    = load_model()
    patients = sample_patients(n=n_patients, seed=seed)
    return simulate_day(patients, model)


if __name__ == "__main__":
    results = run_simulation()
    agg_f = results["fixed"]["aggregate"]
    agg_a = results["ai"]["aggregate"]
    print(f"\n{'':=<55}")
    print(f"{'METRIC':<30} {'FIXED':>10} {'AI':>10}")
    print(f"{'':=<55}")
    for key in agg_f:
        print(f"{key:<30} {str(agg_f[key]):>10} {str(agg_a[key]):>10}")
    print(f"{'':=<55}")
    print(f"Time saved vs fixed scheduling: {results['time_saved_pct']}%")
