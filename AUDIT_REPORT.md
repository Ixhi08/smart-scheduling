# Smart Scheduling — Final Technical Audit

## Status

The audited codebase is ready for a final local retrain/build and deployment. The currently deployed GitHub/Render/Vercel version predates these audit fixes.

## Audits performed

### 1. Predictive-input audit

**Finding:** The earlier model used `complexity_score`, `insurance_type`, and `arrived_late_min` as predictors.

**Fixes:**
- Removed `complexity_score` entirely. It was a manually assigned visit-type proxy closely tied to the synthetic duration assumptions and was redundant with `visit_type`.
- Removed `insurance_type` from prediction and from the synthetic duration-generating equation. It is retained only as an audit attribute.
- Removed `arrived_late_min` from prediction because lateness is not known when a future appointment is booked. It remains an operational simulation variable.
- Final model inputs are: `visit_type`, `provider_type`, `day_of_week`, `age`, `num_conditions`, `is_first_visit`.

### 2. Synthetic-data audit

**Finding:** Earlier documentation could make the per-visit-type synthetic assumptions sound more clinically grounded than they are.

**Fixes:**
- The generator now explicitly labels per-visit-type baselines and feature multipliers as transparent synthetic assumptions, not fitted clinical coefficients.
- Added visit-type-specific plausible age support.
- Insurance is age-coherent for subgroup auditing but does not affect generated duration.
- Development dataset is deterministic at seed 42.
- Added a separate 1,500-record simulation-evaluation dataset at seed 2026.

### 3. Train/calibration/test audit

- 60% train / 20% calibration / 20% untouched final test.
- Model selection uses 5-fold stratified CV on training data only.
- Calibration data is used only for conformal intervals.
- Final test data is not used for selection or calibration.
- Repeated training runs produced identical reported metrics under the fixed random seeds.

**Audited held-out results:**
- Selected model: Neural Network (`MLPRegressor`)
- CV MAE: 3.798 ± 0.127 min
- Final-test MAE: 3.909 min
- Final-test RMSE: 5.193 min
- Final-test R²: 0.7536
- 90% nominal conformal target: 93.5% empirical held-out coverage
- Average interval width: 19.99 min

### 4. Conformal-uncertainty audit

- Uses split conformal absolute residuals.
- Uses visit-type (Mondrian) calibration when the calibration group has enough observations.
- Rare groups use the global finite-sample fallback.
- README/UI now says **90% nominal** target and explicitly notes that finite subgroup empirical coverage can vary, especially for rare categories.

### 5. Explainability / what-if audit

**Finding:** Boundary what-if values could leave the synthetic training support after adding age validation, and the chronic-condition curve included 5 despite training data using 0–4.

**Fixes:**
- What-if ages are clipped/generated strictly within each visit type's synthetic training age range.
- Chronic-condition input and what-if curves are restricted to 0–4.
- Explanation remains explicitly labeled sequential local sensitivity, not SHAP and not causal attribution.
- Boundary tests added to CI.

### 6. Simulator / optimizer audit

**Finding:** The original project let future scheduled start times react to realized earlier durations and the old “~77% overtime reduction” metric was not true clinic overtime past closing.

**Fixes:**
- Entire schedule is now booked before any realized durations are revealed.
- Fixed, adaptive, and robust schedules are evaluated sequentially afterward.
- Actual durations are never used for ordering or slot allocation.
- Clinic overtime now means actual completion past configured clinic closing time.
- Separate simulation-evaluation pool prevents repeatedly tuning the simulator on the final ML test set.
- Optimizer refuses to compress below rounded point predictions simply to claim capacity feasibility.
- Infeasible schedules are visibly flagged.

**Important interpretation:** The robust scheduler trades capacity/provider idle time for lower patient waiting and lower appointment-duration overrun. It is **not** claimed to reduce every metric or universally reduce clinic overtime. The old 77% overtime claim has been removed.

### 7. Scenario audit

- Primary Care, Pediatrics, Cardiology, and Urgent Care are transparent filters over the independent synthetic evaluation pool.
- Presets enforce age ranges and allowed visit types.
- They are explicitly described as demonstration scenarios, not specialty-trained or clinically validated models.

### 8. Subgroup audit

- Insurance is excluded from the predictive model and duration generation.
- It is used only to inspect synthetic subgroup error/coverage.
- Final-test synthetic insurance MAE gap: 0.738 min.
- README/UI explicitly state that this is a methodological diagnostic, not evidence of real-world fairness/equity.

### 9. Code / deployment / security audit

- Backend files compile successfully.
- No-lookahead invariants pass.
- Prediction/explanation boundary tests pass.
- Scenario preset tests pass.
- Development/evaluation dataset separation checks pass.
- No API keys, passwords, private emails, or credentials were found in source files.
- CORS defaults are restricted to localhost and the deployed Vercel origin rather than `*`.
- GitHub Actions CI regenerates deterministic data, retrains, compiles backend, runs invariant tests, runs frontend tests, and performs a production frontend build.

## Claims safe to use after deploying this audited version

- Built a full-stack ML system for appointment-duration prediction and clinic scheduling.
- Benchmarked four regression models with train/calibration/test separation and 5-fold CV model selection.
- Selected neural network achieved ~3.91-minute MAE and R² ~0.754 on the untouched synthetic final test split.
- Added 90% nominal split-conformal prediction intervals with 93.5% empirical held-out coverage in this synthetic experiment.
- Added sequential local sensitivity / what-if analysis, capacity-aware robust slot allocation, and no-lookahead discrete-event clinic simulation.

## Claims to avoid

- Do **not** use the old “77% less overtime” claim.
- Do **not** describe the data/results as real clinical validation.
- Do **not** call the local sensitivity explanation SHAP.
- Do **not** claim subgroup diagnostics demonstrate real-world fairness.
- Do **not** claim every optimized schedule improves overtime or provider utilization; the scheduler exposes tradeoffs.
