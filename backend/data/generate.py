"""
Synthetic dataset generator for Smart Scheduling.

Important methodological note
-----------------------------
This project is a research/engineering demonstration, not a clinical model.
The generator is inspired by published primary-care visit-duration literature,
but most per-visit-type durations and feature effects below are explicit synthetic
assumptions for simulation. They are not fitted clinical coefficients.

A useful external anchor is Chen, Farwell & Jha (2009), which reported a mean
adult primary-care visit duration of 18.9 minutes in 1997-2005 NAMCS data:
https://doi.org/10.1001/archinternmed.2009.341

Two deterministic datasets are written when this file is run:
- smart_scheduling_data.csv: model development (train/calibration/final test)
- simulation_evaluation_data.csv: separate clinic-simulation evaluation pool

The second dataset uses a different RNG seed and is never used to fit, calibrate,
or select the predictive model.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

# Each entry: base duration (min), noise SD (min), plausible synthetic age range.
# These are transparent simulation assumptions, not clinical estimates.
VISIT_TYPES = {
    "Upper Respiratory Infection":     (12, 3.5, 5, 85),
    "Hypertension Follow-up":          (22, 5.0, 35, 85),
    "Type 2 Diabetes Management":      (28, 6.0, 25, 85),
    "Annual Wellness Exam":            (35, 7.0, 18, 85),
    "Acute Back Pain":                 (18, 4.5, 16, 85),
    "Anxiety / Depression Follow-up":  (25, 5.5, 16, 80),
    "Minor Laceration / Wound Care":   (14, 3.0, 5, 85),
    "Urinary Tract Infection":         (11, 3.0, 12, 85),
    "Chest Pain Evaluation":           (32, 7.5, 18, 85),
    "Pediatric Well Visit":            (20, 4.0, 2, 17),
    "Asthma Management":               (21, 5.0, 5, 80),
    "Skin Rash / Dermatology":         (13, 3.5, 5, 85),
    "Knee / Joint Pain":               (19, 4.5, 12, 85),
    "Medication Refill Only":          (8,  2.5, 18, 85),
    "New Patient Intake":              (40, 8.0, 18, 85),
}

VISIT_TYPE_PROBS = [
    0.10, 0.09, 0.08, 0.07, 0.08, 0.07, 0.06, 0.07,
    0.05, 0.06, 0.06, 0.05, 0.06, 0.08, 0.02,
]

PROVIDER_TYPES = ["MD", "DO", "NP", "PA"]
PROVIDER_MULTIPLIERS = {"MD": 1.00, "DO": 1.00, "NP": 0.94, "PA": 0.96}

DAY_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
DAY_MULTIPLIERS = {"Monday": 1.05, "Tuesday": 1.02, "Wednesday": 1.00, "Thursday": 0.99, "Friday": 0.97}

INSURANCE_TYPES = ["Private", "Medicare", "Medicaid", "Uninsured"]


def _sample_insurance(rng: np.random.Generator, age: int) -> str:
    """Generate an audit-only insurance attribute with age-coherent probabilities.

    Insurance is intentionally NOT used to generate visit duration and is NOT a
    model input. It is retained only for subgroup performance auditing.
    """
    if age < 18:
        return str(rng.choice(["Private", "Medicaid", "Uninsured"], p=[0.55, 0.38, 0.07]))
    if age >= 65:
        return str(rng.choice(["Medicare", "Private", "Medicaid"], p=[0.75, 0.20, 0.05]))
    return str(rng.choice(["Private", "Medicaid", "Uninsured", "Medicare"], p=[0.66, 0.18, 0.12, 0.04]))


def generate_dataset(n: int = 2000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed=seed)
    visit_type_names = list(VISIT_TYPES.keys())
    records: list[dict] = []

    for _ in range(n):
        visit_type = str(rng.choice(visit_type_names, p=VISIT_TYPE_PROBS))
        base_dur, std_dev, age_min, age_max = VISIT_TYPES[visit_type]

        age = int(rng.integers(age_min, age_max + 1))
        # Transparent synthetic effects. These are not claimed as clinical coefficients.
        age_effect = 1.0 + (max(age - 40, 0) * 0.0025)

        insurance = _sample_insurance(rng, age)  # audit-only, not used below

        provider = str(rng.choice(PROVIDER_TYPES, p=[0.45, 0.20, 0.20, 0.15]))
        prov_mult = PROVIDER_MULTIPLIERS[provider]

        day = str(rng.choice(DAY_OF_WEEK))
        day_mult = DAY_MULTIPLIERS[day]

        num_conditions = int(rng.choice([0, 1, 2, 3, 4], p=[0.40, 0.30, 0.18, 0.08, 0.04]))
        condition_effect = 1.0 + (num_conditions * 0.06)

        is_first_visit = int(rng.random() < 0.15)
        first_visit_effect = 1.18 if is_first_visit else 1.0

        # Operational behavior used by the simulator only. It is deliberately
        # excluded from the appointment-duration prediction model because it is
        # not known when a future appointment is booked.
        arrived_late_min = float(rng.integers(1, 21)) if rng.random() < 0.25 else 0.0

        multiplier = age_effect * prov_mult * day_mult * condition_effect * first_visit_effect
        duration = rng.normal(base_dur * multiplier, std_dev)
        duration = float(np.clip(duration, 5, 75))

        records.append({
            "visit_type": visit_type,
            "age": age,
            "insurance_type": insurance,
            "provider_type": provider,
            "day_of_week": day,
            "num_conditions": num_conditions,
            "is_first_visit": is_first_visit,
            "arrived_late_min": round(arrived_late_min, 1),
            "actual_duration_min": round(duration, 1),
        })

    return pd.DataFrame(records)


def _print_summary(name: str, df: pd.DataFrame, out_path: Path) -> None:
    print(f"\n{name}: {len(df)} records")
    print("Duration stats (minutes):")
    print(df["actual_duration_min"].describe().round(2))
    print("Visit type distribution:")
    print(df["visit_type"].value_counts())
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    base = Path(__file__).parent

    development = generate_dataset(2000, seed=42)
    development_path = base / "smart_scheduling_data.csv"
    development.to_csv(development_path, index=False)
    _print_summary("Development dataset", development, development_path)

    simulation_eval = generate_dataset(1500, seed=2026)
    simulation_path = base / "simulation_evaluation_data.csv"
    simulation_eval.to_csv(simulation_path, index=False)
    _print_summary("Independent simulation-evaluation dataset", simulation_eval, simulation_path)
