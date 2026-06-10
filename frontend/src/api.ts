import { PatientInput, PredictionResult, BenchmarkResult, SimulationResult, VisitTypesResponse } from './types';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  predict:    (p: PatientInput)                          => post<PredictionResult>('/predict', p),
  benchmark:  ()                                         => get<BenchmarkResult>('/benchmark'),
  simulate:   (n_patients: number, seed: number)         => post<SimulationResult>('/simulate', { n_patients, seed }),
  visitTypes: ()                                         => get<VisitTypesResponse>('/visit-types'),
};
