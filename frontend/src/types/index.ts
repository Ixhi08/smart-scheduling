export interface PredictionResult {
  predicted_duration_min: number;
  recommended_slot_min: number;
  confidence_interval: [number, number];
  traditional_slot_min: number;
  time_saved_min: number;
  time_saved_pct: number;
  model_used: string;
  complexity_score: number;
}

export interface PatientInput {
  visit_type: string;
  age: number;
  insurance_type: string;
  provider_type: string;
  day_of_week: string;
  num_conditions: number;
  is_first_visit: number;
  arrived_late_min: number;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
}

export interface BenchmarkResult {
  best_model: string;
  models: Record<string, ModelMetrics>;
  visit_types: string[];
}

export interface Appointment {
  patient_idx: number;
  visit_type: string;
  scheduled_start: number;
  actual_start: number;
  actual_end: number;
  slot_length: number;
  actual_duration: number;
  wait_time: number;
  idle_time: number;
  overtime: number;
  predicted_duration?: number;
}

export interface SimAggregate {
  avg_wait_min: number;
  max_wait_min: number;
  total_idle_min: number;
  total_overtime_min: number;
  total_scheduled_min: number;
  clinic_end_min: number;
  clinic_duration_min: number;
  patients_seen: number;
}

export interface SimulationResult {
  fixed: { appointments: Appointment[]; aggregate: SimAggregate };
  ai: { appointments: Appointment[]; aggregate: SimAggregate };
  time_saved_pct: number;
  num_patients: number;
}

export interface VisitTypesResponse {
  visit_types: string[];
  insurance_types: string[];
  provider_types: string[];
  days_of_week: string[];
}
