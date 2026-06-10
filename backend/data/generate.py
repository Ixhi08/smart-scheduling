"""
Synthetic dataset generator for Smart Scheduling.

Distributions grounded in published primary care literature:
- Median visit ~18 min (Tai-Seale et al., 2017, JAMA Internal Medicine)
- Complex visits (chronic disease mgmt) average 24-28 min
- Simple acute visits (URI, minor injury) average 10-15 min
- Age, insurance type, and visit complexity are meaningful predictors
"""

import numpy as np
import pandas as pd

rng = np.random.default_rng(seed=42)

# --- Visit type definitions ---
# Each entry: (base_duration_min, std_dev, complexity_weight)
VISIT_TYPES = {
    "Upper Respiratory Infection":     (12, 3.5, 0.2),
    "Hypertension Follow-up":          (22, 5.0, 0.7),
    "Type 2 Diabetes Management":      (28, 6.0, 0.9),
    "Annual Wellness Exam":            (35, 7.0, 0.8),
    "Acute Back Pain":                 (18, 4.5, 0.5),
    "Anxiety / Depression Follow-up":  (25, 5.5, 0.7),
    "Minor Laceration / Wound Care":   (14, 3.0, 0.3),
    "Urinary Tract Infection":         (11, 3.0, 0.2),
    "Chest Pain Evaluation":           (32, 7.5, 1.0),
    "Pediatric Well Visit":            (20, 4.0, 0.5),
    "Asthma Management":               (21, 5.0, 0.6),
    "Skin Rash / Dermatology":         (13, 3.5, 0.3),
    "Knee / Joint Pain":               (19, 4.5, 0.5),
    "Medication Refill Only":          (8,  2.5, 0.1),
    "New Patient Intake":              (40, 8.0, 1.0),
}

INSURANCE_TYPES = ["Private", "Medicare", "Medicaid", "Uninsured"]
INSURANCE_MULTIPLIERS = {"Private": 1.0, "Medicare": 1.12, "Medicaid": 1.08, "Uninsured": 1.15}

PROVIDER_TYPES = ["MD", "DO", "NP", "PA"]
PROVIDER_MULTIPLIERS = {"MD": 1.0, "DO": 1.0, "NP": 0.92, "PA": 0.95}

DAY_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
# Mondays tend to run longer (backlog), Fridays shorter
DAY_MULTIPLIERS = {"Monday": 1.08, "Tuesday": 1.02, "Wednesday": 1.0, "Thursday": 0.98, "Friday": 0.95}


def generate_dataset(n: int = 2000) -> pd.DataFrame:
    visit_type_names = list(VISIT_TYPES.keys())
    visit_type_probs = [0.10, 0.09, 0.08, 0.07, 0.08, 0.07, 0.06,
                        0.07, 0.05, 0.06, 0.06, 0.05, 0.06, 0.08, 0.02]

    records = []

    for _ in range(n):
        visit_type = rng.choice(visit_type_names, p=visit_type_probs)
        base_dur, std_dev, complexity = VISIT_TYPES[visit_type]

        age = int(rng.integers(2, 85))
        # Older patients tend to take slightly longer
        age_effect = 1.0 + (max(age - 40, 0) * 0.003)

        insurance = rng.choice(INSURANCE_TYPES, p=[0.45, 0.25, 0.20, 0.10])
        ins_mult = INSURANCE_MULTIPLIERS[insurance]

        provider = rng.choice(PROVIDER_TYPES, p=[0.45, 0.20, 0.20, 0.15])
        prov_mult = PROVIDER_MULTIPLIERS[provider]

        day = rng.choice(DAY_OF_WEEK)
        day_mult = DAY_MULTIPLIERS[day]

        # Number of active chronic conditions (0-4)
        num_conditions = int(rng.choice([0, 1, 2, 3, 4], p=[0.40, 0.30, 0.18, 0.08, 0.04]))
        condition_effect = 1.0 + (num_conditions * 0.06)

        # First visit flag
        is_first_visit = int(rng.random() < 0.15)
        first_visit_effect = 1.20 if is_first_visit else 1.0

        # Late arrival (minutes late, 0-20)
        arrived_late_min = float(rng.choice([0]*7 + list(range(1, 21)), replace=False)) if rng.random() < 0.25 else 0.0

        # Compute actual duration
        multiplier = age_effect * ins_mult * prov_mult * day_mult * condition_effect * first_visit_effect
        duration = rng.normal(base_dur * multiplier, std_dev)
        duration = float(np.clip(duration, 5, 75))  # real-world bounds

        records.append({
            "visit_type":          visit_type,
            "age":                 age,
            "insurance_type":      insurance,
            "provider_type":       provider,
            "day_of_week":         day,
            "num_conditions":      num_conditions,
            "is_first_visit":      is_first_visit,
            "arrived_late_min":    round(arrived_late_min, 1),
            "complexity_score":    round(complexity, 2),
            "actual_duration_min": round(duration, 1),
        })

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    df = generate_dataset(2000)
    out_path = "smart_scheduling_data.csv"
    df.to_csv(out_path, index=False)

    print(f"Generated {len(df)} records")
    print(f"\nDuration stats (minutes):")
    print(df["actual_duration_min"].describe().round(2))
    print(f"\nVisit type distribution:")
    print(df["visit_type"].value_counts())
    print(f"\nSaved to {out_path}")
