export interface PredictionResult {
  predicted_duration_min: number;
  recommended_slot_min: number;
  prediction_interval: [number, number];
  confidence_interval: [number, number];
  interval_level: number;
  interval_width_min: number;
  conformal_qhat_min: number;
  uncertainty_level: 'Low' | 'Moderate' | 'Higher' | string;
  empirical_coverage: number;
  traditional_slot_min: number;
  slot_adjustment_min: number;
  time_saved_min: number;
  time_saved_pct: number;
  model_used: string;
  recommended_slot_basis: string;
}

export interface PatientInput {
  visit_type: string;
  age: number;
  provider_type: string;
  day_of_week: string;
  num_conditions: number;
  is_first_visit: number;
}

export interface Contribution {
  feature: string;
  label: string;
  value: string;
  impact_min: number;
  direction: 'longer' | 'shorter' | 'neutral' | string;
}

export interface LocalExplanation {
  method: string;
  warning: string;
  reference_profile: Record<string, string | number>;
  baseline_prediction_min: number;
  final_prediction_min: number;
  total_delta_min: number;
  contributions: Contribution[];
}

export interface WhatIfPoint {
  x: string | number;
  predicted_duration_min: number;
  lower: number;
  upper: number;
}

export interface ExplainResult {
  prediction: PredictionResult;
  explanation: LocalExplanation;
  what_if: {
    num_conditions: WhatIfPoint[];
    age: WhatIfPoint[];
    first_visit: WhatIfPoint[];
    day_of_week: WhatIfPoint[];
  };
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
  test_mae: number;
  test_rmse: number;
  test_r2: number;
  cv_mae_mean: number;
  cv_mae_std: number;
  cv_rmse_mean: number;
  cv_rmse_std: number;
  cv_r2_mean: number;
  cv_r2_std: number;
}

export interface BenchmarkSelection {
  method: string;
  selection_metric: string;
  cv_folds: number;
  selected_cv_mae: number;
}

export interface DataSplit {
  random_state: number;
  train_size: number;
  calibration_size: number;
  test_size: number;
  train_fraction: number;
  calibration_fraction: number;
  test_fraction: number;
}

export interface ConformalMetrics {
  method: string;
  grouping: string;
  alpha: number;
  nominal_coverage: number;
  calibration_size: number;
  minimum_group_calibration: number;
  quantile_rank: number;
  quantile_level: number;
  global_qhat_min: number;
  qhat_min: number;
  qhat_by_visit_type: Record<string, number>;
  calibration_group_sizes: Record<string, number>;
  uncertainty_thresholds: {
    low_max_qhat_min: number;
    moderate_max_qhat_min: number;
  };
  test_empirical_coverage: number;
  test_avg_interval_width_min: number;
  test_median_interval_width_min: number;
}

export interface FeatureImportance {
  feature: string;
  importance_mean: number;
  importance_std: number;
}

export interface TestPoint {
  actual: number;
  predicted: number;
  residual: number;
  abs_error: number;
  lower: number;
  upper: number;
  covered: boolean;
  visit_type: string;
  age: number;
}

export interface GroupDiagnostic {
  group: string;
  count: number;
  mae: number;
  coverage: number;
  avg_interval_width?: number;
  qhat_min?: number | null;
}

export interface ResidualBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface BenchmarkAnalytics {
  feature_importance: FeatureImportance[];
  test_points: TestPoint[];
  error_by_visit_type: GroupDiagnostic[];
  error_by_age_group: GroupDiagnostic[];
  error_by_insurance_type: GroupDiagnostic[];
  insurance_mae_gap_min: number | null;
  subgroup_audit_note: string;
  residual_histogram: ResidualBin[];
}

export interface BenchmarkResult {
  best_model: string;
  selection: BenchmarkSelection;
  split: DataSplit;
  models: Record<string, ModelMetrics>;
  conformal: ConformalMetrics;
  analytics: BenchmarkAnalytics;
  reference_profile: Record<string, string | number>;
  visit_types: string[];
  feature_names: string[];
  duration_bounds_min: [number, number];
}

export interface Appointment {
  patient_idx: number;
  schedule_position: number;
  visit_type: string;
  scheduled_start: number;
  scheduled_end: number;
  arrival_time: number;
  actual_start: number;
  actual_end: number;
  slot_length: number;
  predicted_duration: number;
  interval_lower: number;
  interval_upper: number;
  actual_duration: number;
  wait_time: number;
  schedule_delay: number;
  provider_idle_time: number;
  duration_overrun: number;
  completion_delay: number;
}

export interface SimAggregate {
  avg_wait_min: number;
  max_wait_min: number;
  total_patient_wait_min: number;
  total_provider_idle_min: number;
  total_duration_overrun_min: number;
  avg_completion_delay_min: number;
  clinic_overtime_min: number;
  scheduled_overflow_min: number;
  scheduled_end_min: number;
  actual_clinic_end_min: number;
  on_time_start_pct: number;
  patients_seen: number;
  total_scheduled_min: number;
}

export interface StrategyResult {
  name: string;
  appointments: Appointment[];
  aggregate: SimAggregate;
}

export interface OptimizationInfo {
  capacity_min: number;
  desired_total_min: number;
  base_total_min: number;
  allocated_total_min: number;
  capacity_feasible: boolean;
  buffer_compressed_min: number;
  scheduled_over_capacity_min: number;
  method: string;
  ordering: string;
  reordered: boolean;
}

export interface ComparisonMetrics {
  avg_wait_reduction_pct: number | null;
  total_wait_reduction_pct: number | null;
  clinic_overtime_reduction_pct: number | null;
  duration_overrun_reduction_pct: number | null;
}

export interface SimulationResult {
  fixed: StrategyResult;
  adaptive: StrategyResult;
  optimized: StrategyResult;
  ai: StrategyResult;
  optimization: OptimizationInfo;
  comparisons: {
    optimized_vs_fixed: ComparisonMetrics;
  };
  num_patients: number;
  scenario_preset: string;
  clinic: {
    start_min: number;
    end_min: number;
    lunch_start_min: number;
    lunch_end_min: number;
    working_capacity_min: number;
    optimizer_slot_capacity_min: number;
    closing_buffer_min: number;
  };
  methodology_note: string;
}

export interface SimulationRequest {
  n_patients: number;
  seed: number;
  preset: string;
  clinic_start_hour: number;
  clinic_end_hour: number;
  lunch_start_hour: number;
  lunch_duration_min: number;
  closing_buffer_min: number;
  allow_reordering: boolean;
}

export interface VisitTypesResponse {
  visit_types: string[];
  visit_type_age_ranges: Record<string, [number, number]>;
  provider_types: string[];
  days_of_week: string[];
  scenario_presets: string[];
}
