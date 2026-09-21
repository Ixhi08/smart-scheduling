"""
Smart Scheduling — uncertainty-aware clinic scheduling simulation.

This simulator fixes the original methodological problem where future appointment
start times were moved forward after observing earlier appointments. Scheduled
start times are now booked in advance from slot lengths only; actual delays then
cascade independently through the clinic day.

Strategies
----------
1. fixed:      20-minute slots, original patient order.
2. adaptive:   visit-type Mondrian conformal upper bound rounded to 5 minutes.
3. optimized:  constrained robust slot allocation within clinic capacity, plus an
               optional risk-first ordering heuristic based ONLY on model outputs
               (never actual durations).

Actual durations are used only after a schedule has been created, for evaluation.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

BASE = Path(__file__).parent
MODEL_PATH = BASE / "models" / "best_model.joblib"
BENCHMARK_PATH = BASE / "models" / "benchmark_results.json"
DATA_PATH = BASE / "data" / "smart_scheduling_data.csv"

FIXED_SLOT_MIN = 20
SLOT_INCREMENT_MIN = 5
DEFAULT_CLINIC_START_MIN = 8 * 60
DEFAULT_CLINIC_END_MIN = 17 * 60
DEFAULT_LUNCH_START_MIN = 12 * 60
DEFAULT_LUNCH_DURATION_MIN = 60
DEFAULT_CLOSING_BUFFER_MIN = 30
MIN_SLOT_MIN = 10

FEATURE_COLS = [
    "visit_type",
    "insurance_type",
    "provider_type",
    "day_of_week",
    "age",
    "num_conditions",
    "is_first_visit",
    "arrived_late_min",
    "complexity_score",
]

SCENARIO_PRESETS = {
    "Primary Care": None,  # full dataset
    "Pediatrics": [
        "Pediatric Well Visit",
        "Upper Respiratory Infection",
        "Asthma Management",
        "Skin Rash / Dermatology",
        "Urinary Tract Infection",
    ],
    "Cardiology": [
        "Hypertension Follow-up",
        "Chest Pain Evaluation",
        "Type 2 Diabetes Management",
    ],
    "Urgent Care": [
        "Upper Respiratory Infection",
        "Acute Back Pain",
        "Minor Laceration / Wound Care",
        "Urinary Tract Infection",
        "Chest Pain Evaluation",
        "Skin Rash / Dermatology",
        "Knee / Joint Pain",
    ],
}


def load_artifacts():
    model = joblib.load(MODEL_PATH)
    benchmark = json.loads(BENCHMARK_PATH.read_text())
    return model, benchmark


def _round_up(value: float, increment: int = SLOT_INCREMENT_MIN) -> int:
    return int(math.ceil(float(value) / increment) * increment)


def _qhat_for_type(benchmark: dict, visit_type: str) -> float:
    conf = benchmark["conformal"]
    return float(conf.get("qhat_by_visit_type", {}).get(visit_type, conf["global_qhat_min"]))


def sample_patients(n: int = 24, seed: int = 99, preset: str = "Primary Care") -> pd.DataFrame:
    """Sample a reproducible synthetic clinic day from the generated dataset."""
    df = pd.read_csv(DATA_PATH)

    # Reconstruct the exact untouched 20% final-test partition used by train.py.
    # Simulation therefore evaluates schedules only on records that were never
    # used to fit the deployed model or conformal calibration.
    all_idx = np.arange(len(df))
    _, test_idx = train_test_split(
        all_idx,
        test_size=0.20,
        random_state=42,
        stratify=df["visit_type"],
    )
    df = df.iloc[test_idx].copy()

    allowed = SCENARIO_PRESETS.get(preset)
    if allowed is None and preset not in SCENARIO_PRESETS:
        raise ValueError(f"Unknown scenario preset: {preset}")
    if allowed:
        df = df[df["visit_type"].isin(allowed)].copy()
    if df.empty:
        raise ValueError(f"Scenario preset {preset!r} has no eligible records")

    replace = len(df) < n
    sampled = df.sample(n=n, random_state=seed, replace=replace).reset_index(drop=True)
    sampled["patient_idx"] = np.arange(len(sampled), dtype=int)
    return sampled


def add_model_outputs(patients: pd.DataFrame, model, benchmark: dict) -> pd.DataFrame:
    plan = patients.copy()
    predictions = np.asarray(model.predict(plan[FEATURE_COLS]), dtype=float)
    lo_bound, hi_bound = benchmark.get("duration_bounds_min", [5.0, 75.0])
    predictions = np.clip(predictions, float(lo_bound), float(hi_bound))
    qhats = np.array([_qhat_for_type(benchmark, str(v)) for v in plan["visit_type"]])
    plan["predicted_duration"] = predictions
    plan["qhat_min"] = qhats
    plan["interval_lower"] = np.clip(predictions - qhats, lo_bound, hi_bound)
    plan["interval_upper"] = np.clip(predictions + qhats, lo_bound, hi_bound)
    return plan


def _working_capacity(
    clinic_start: int,
    clinic_end: int,
    lunch_start: int,
    lunch_end: int,
) -> int:
    total = max(0, clinic_end - clinic_start)
    lunch_overlap = max(0, min(clinic_end, lunch_end) - max(clinic_start, lunch_start))
    return max(0, total - lunch_overlap)


def _next_bookable_start(t: float, slot: float, lunch_start: int, lunch_end: int) -> float:
    """Return a pre-booked start that does not begin in or cross the lunch block."""
    if lunch_start <= t < lunch_end:
        t = float(lunch_end)
    if t < lunch_start and t + slot > lunch_start:
        t = float(lunch_end)
    return t


def build_scheduled_starts(
    slots: Iterable[int],
    clinic_start: int,
    lunch_start: int,
    lunch_end: int,
) -> list[float]:
    starts: list[float] = []
    cursor = float(clinic_start)
    for slot in slots:
        cursor = _next_bookable_start(cursor, float(slot), lunch_start, lunch_end)
        starts.append(cursor)
        cursor += float(slot)
    return starts


def _business_idle_minutes(start: float, end: float, lunch_start: int, lunch_end: int) -> float:
    """Provider idle time excluding the planned lunch interval."""
    if end <= start:
        return 0.0
    raw = end - start
    overlap = max(0.0, min(end, lunch_end) - max(start, lunch_start))
    return max(0.0, raw - overlap)


def allocate_robust_slots(
    predictions: np.ndarray,
    uppers: np.ndarray,
    qhats: np.ndarray,
    capacity_min: int,
) -> tuple[np.ndarray, dict]:
    """Allocate robust slots under a clinic-capacity constraint.

    Desired slot = conformal upper bound rounded to 5 minutes.
    Base slot    = point prediction rounded to 5 minutes (>=10 min).

    If desired slots exceed capacity but point-prediction slots fit, the allocator
    removes 5-minute increments with the smallest weighted quadratic penalty,
    preferentially preserving extra buffer for higher-uncertainty appointments.
    It never compresses below the rounded point prediction merely to claim a fit.
    """
    desired = np.array([max(MIN_SLOT_MIN, _round_up(x)) for x in uppers], dtype=int)
    base = np.array([max(MIN_SLOT_MIN, _round_up(x)) for x in predictions], dtype=int)
    current = desired.copy()

    desired_total = int(current.sum())
    base_total = int(base.sum())
    feasible = base_total <= capacity_min

    if desired_total > capacity_min and feasible:
        while int(current.sum()) > capacity_min:
            candidates = np.where(current - SLOT_INCREMENT_MIN >= base)[0]
            if len(candidates) == 0:
                break
            penalties = []
            for i in candidates:
                removed = desired[i] - current[i]
                incremental_quadratic = (removed + SLOT_INCREMENT_MIN) ** 2 - removed**2
                # Higher qhat => protect buffer more strongly.
                weighted_penalty = incremental_quadratic * max(float(qhats[i]), 1.0)
                penalties.append((weighted_penalty, i))
            _, chosen = min(penalties, key=lambda x: (x[0], x[1]))
            current[chosen] -= SLOT_INCREMENT_MIN

    return current, {
        "capacity_min": int(capacity_min),
        "desired_total_min": desired_total,
        "base_total_min": base_total,
        "allocated_total_min": int(current.sum()),
        "capacity_feasible": bool(feasible),
        "buffer_compressed_min": int(max(0, desired_total - int(current.sum()))),
        "scheduled_over_capacity_min": int(max(0, int(current.sum()) - capacity_min)),
        "method": "uncertainty-weighted constrained 5-minute slot allocation",
    }


def risk_first_order(plan: pd.DataFrame) -> pd.DataFrame:
    """Optional deterministic ordering heuristic using predictions only.

    Higher robust duration (prediction + qhat) is scheduled earlier. Actual
    durations are deliberately excluded to prevent look-ahead leakage.
    """
    ordered = plan.copy()
    ordered["risk_score"] = ordered["predicted_duration"] + ordered["qhat_min"]
    return ordered.sort_values(
        ["risk_score", "predicted_duration", "patient_idx"],
        ascending=[False, False, True],
        kind="mergesort",
    ).reset_index(drop=True)


def simulate_booked_schedule(
    plan: pd.DataFrame,
    slots: np.ndarray,
    clinic_start: int,
    clinic_end: int,
    lunch_start: int,
    lunch_end: int,
    strategy_name: str,
) -> dict:
    """Evaluate an already-booked schedule using held-out synthetic actual durations."""
    scheduled_starts = build_scheduled_starts(slots, clinic_start, lunch_start, lunch_end)
    provider_available = float(clinic_start)
    appointments = []

    for pos, (_, row) in enumerate(plan.iterrows()):
        scheduled_start = float(scheduled_starts[pos])
        slot_length = int(slots[pos])
        scheduled_end = scheduled_start + slot_length
        arrival = scheduled_start + max(0.0, float(row["arrived_late_min"]))
        actual_start = max(provider_available, arrival)
        provider_idle = _business_idle_minutes(provider_available, actual_start, lunch_start, lunch_end)
        patient_wait = max(0.0, actual_start - arrival)
        schedule_delay = max(0.0, actual_start - scheduled_start)
        actual_duration = float(row["actual_duration_min"])
        actual_end = actual_start + actual_duration
        slot_overrun = max(0.0, actual_end - scheduled_end)
        provider_available = actual_end

        appointments.append(
            {
                "patient_idx": int(row["patient_idx"]),
                "schedule_position": pos,
                "visit_type": str(row["visit_type"]),
                "scheduled_start": round(scheduled_start, 1),
                "scheduled_end": round(scheduled_end, 1),
                "arrival_time": round(arrival, 1),
                "actual_start": round(actual_start, 1),
                "actual_end": round(actual_end, 1),
                "slot_length": slot_length,
                "predicted_duration": round(float(row["predicted_duration"]), 1),
                "interval_lower": round(float(row["interval_lower"]), 1),
                "interval_upper": round(float(row["interval_upper"]), 1),
                "actual_duration": round(actual_duration, 1),
                "wait_time": round(patient_wait, 1),
                "schedule_delay": round(schedule_delay, 1),
                "provider_idle_time": round(provider_idle, 1),
                "duration_overrun": round(max(0.0, actual_duration - slot_length), 1),
                "completion_delay": round(slot_overrun, 1),
            }
        )

    actual_end_time = float(appointments[-1]["actual_end"]) if appointments else float(clinic_start)
    scheduled_end_time = max((float(a["scheduled_end"]) for a in appointments), default=float(clinic_start))
    waits = np.array([a["wait_time"] for a in appointments], dtype=float)
    delays = np.array([a["schedule_delay"] for a in appointments], dtype=float)

    aggregate = {
        "avg_wait_min": round(float(waits.mean()) if len(waits) else 0.0, 1),
        "max_wait_min": round(float(waits.max()) if len(waits) else 0.0, 1),
        "total_patient_wait_min": round(float(waits.sum()), 1),
        "total_provider_idle_min": round(float(sum(a["provider_idle_time"] for a in appointments)), 1),
        "total_duration_overrun_min": round(float(sum(a["duration_overrun"] for a in appointments)), 1),
        "avg_completion_delay_min": round(float(np.mean([a["completion_delay"] for a in appointments])) if appointments else 0.0, 1),
        "clinic_overtime_min": round(max(0.0, actual_end_time - clinic_end), 1),
        "scheduled_overflow_min": round(max(0.0, scheduled_end_time - clinic_end), 1),
        "scheduled_end_min": round(scheduled_end_time, 1),
        "actual_clinic_end_min": round(actual_end_time, 1),
        "on_time_start_pct": round(float(np.mean(delays <= 5.0) * 100) if len(delays) else 100.0, 1),
        "patients_seen": len(appointments),
        "total_scheduled_min": int(sum(a["slot_length"] for a in appointments)),
    }
    return {
        "name": strategy_name,
        "appointments": appointments,
        "aggregate": aggregate,
    }


def _pct_reduction(baseline: float, candidate: float) -> float | None:
    if baseline <= 0:
        return None
    return round((baseline - candidate) / baseline * 100.0, 1)


def simulate_day(
    patients: pd.DataFrame,
    model,
    benchmark: dict,
    *,
    clinic_start: int = DEFAULT_CLINIC_START_MIN,
    clinic_end: int = DEFAULT_CLINIC_END_MIN,
    lunch_start: int = DEFAULT_LUNCH_START_MIN,
    lunch_duration: int = DEFAULT_LUNCH_DURATION_MIN,
    closing_buffer: int = DEFAULT_CLOSING_BUFFER_MIN,
    allow_reordering: bool = True,
) -> dict:
    if clinic_end <= clinic_start:
        raise ValueError("clinic_end must be after clinic_start")
    lunch_end = lunch_start + max(0, lunch_duration)
    working_capacity = _working_capacity(clinic_start, clinic_end, lunch_start, lunch_end)
    capacity = max(0, working_capacity - max(0, closing_buffer))
    if capacity <= 0:
        raise ValueError("Clinic configuration leaves no schedulable capacity after the closing buffer")

    base_plan = add_model_outputs(patients, model, benchmark)

    # Fixed: original order, 20-minute slots.
    fixed_plan = base_plan.reset_index(drop=True)
    fixed_slots = np.full(len(fixed_plan), FIXED_SLOT_MIN, dtype=int)
    fixed = simulate_booked_schedule(
        fixed_plan, fixed_slots, clinic_start, clinic_end, lunch_start, lunch_end, "Fixed 20-minute slots"
    )

    # Adaptive: original order, conformal upper-bound slots, unconstrained.
    adaptive_plan = base_plan.reset_index(drop=True)
    adaptive_slots = np.array([max(MIN_SLOT_MIN, _round_up(x)) for x in adaptive_plan["interval_upper"]], dtype=int)
    adaptive = simulate_booked_schedule(
        adaptive_plan,
        adaptive_slots,
        clinic_start,
        clinic_end,
        lunch_start,
        lunch_end,
        "Conformal adaptive slots",
    )

    # Optimized: optional risk-first ordering + capacity-aware robust allocation.
    optimized_plan = risk_first_order(base_plan) if allow_reordering else base_plan.reset_index(drop=True)
    optimized_slots, optimization = allocate_robust_slots(
        optimized_plan["predicted_duration"].to_numpy(dtype=float),
        optimized_plan["interval_upper"].to_numpy(dtype=float),
        optimized_plan["qhat_min"].to_numpy(dtype=float),
        capacity,
    )
    optimized = simulate_booked_schedule(
        optimized_plan,
        optimized_slots,
        clinic_start,
        clinic_end,
        lunch_start,
        lunch_end,
        "Uncertainty-aware optimized schedule",
    )
    optimization["ordering"] = "risk-first heuristic" if allow_reordering else "original order"
    optimization["reordered"] = bool(allow_reordering)

    comparisons = {
        "optimized_vs_fixed": {
            "avg_wait_reduction_pct": _pct_reduction(
                fixed["aggregate"]["avg_wait_min"], optimized["aggregate"]["avg_wait_min"]
            ),
            "total_wait_reduction_pct": _pct_reduction(
                fixed["aggregate"]["total_patient_wait_min"], optimized["aggregate"]["total_patient_wait_min"]
            ),
            "clinic_overtime_reduction_pct": _pct_reduction(
                fixed["aggregate"]["clinic_overtime_min"], optimized["aggregate"]["clinic_overtime_min"]
            ),
            "duration_overrun_reduction_pct": _pct_reduction(
                fixed["aggregate"]["total_duration_overrun_min"], optimized["aggregate"]["total_duration_overrun_min"]
            ),
        }
    }

    return {
        "fixed": fixed,
        "adaptive": adaptive,
        "optimized": optimized,
        # compatibility alias for older clients
        "ai": optimized,
        "optimization": optimization,
        "comparisons": comparisons,
        "num_patients": len(patients),
        "scenario_preset": None,
        "clinic": {
            "start_min": clinic_start,
            "end_min": clinic_end,
            "lunch_start_min": lunch_start,
            "lunch_end_min": lunch_end,
            "working_capacity_min": working_capacity,
            "optimizer_slot_capacity_min": capacity,
            "closing_buffer_min": max(0, closing_buffer),
        },
        "methodology_note": (
            "Schedules are booked before actual durations are revealed and are evaluated on the untouched final-test partition. "
            "Optimized ordering uses model predictions/uncertainty, never realized durations."
        ),
    }


def run_simulation(
    n_patients: int = 16,
    seed: int = 99,
    preset: str = "Primary Care",
    clinic_start: int = DEFAULT_CLINIC_START_MIN,
    clinic_end: int = DEFAULT_CLINIC_END_MIN,
    lunch_start: int = DEFAULT_LUNCH_START_MIN,
    lunch_duration: int = DEFAULT_LUNCH_DURATION_MIN,
    closing_buffer: int = DEFAULT_CLOSING_BUFFER_MIN,
    allow_reordering: bool = True,
    model=None,
    benchmark: dict | None = None,
) -> dict:
    if model is None or benchmark is None:
        model, benchmark = load_artifacts()
    patients = sample_patients(n=n_patients, seed=seed, preset=preset)
    result = simulate_day(
        patients,
        model,
        benchmark,
        clinic_start=clinic_start,
        clinic_end=clinic_end,
        lunch_start=lunch_start,
        lunch_duration=lunch_duration,
        closing_buffer=closing_buffer,
        allow_reordering=allow_reordering,
    )
    result["scenario_preset"] = preset
    return result


if __name__ == "__main__":
    result = run_simulation()
    for key in ["fixed", "adaptive", "optimized"]:
        print(f"\n{key.upper()}")
        for metric, value in result[key]["aggregate"].items():
            print(f"  {metric:<28} {value}")
    print("\nOptimization:", result["optimization"])
