import {
  BenchmarkResult,
  ExplainResult,
  PatientInput,
  PredictionResult,
  SimulationRequest,
  SimulationResult,
  VisitTypesResponse,
} from './types';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  predict: (p: PatientInput) => post<PredictionResult>('/predict', p),
  explain: (p: PatientInput) => post<ExplainResult>('/explain', p),
  benchmark: () => get<BenchmarkResult>('/benchmark'),
  simulate: (req: SimulationRequest) => post<SimulationResult>('/simulate', req),
  visitTypes: () => get<VisitTypesResponse>('/visit-types'),
  health: () => get<{ status: string; model: string; interval_level: number; api_version: string }>('/health'),
};
