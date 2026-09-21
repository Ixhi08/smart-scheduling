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

const FIELD_LABELS: Record<string, string> = {
  visit_type: 'Visit type',
  age: 'Age',
  provider_type: 'Provider',
  day_of_week: 'Day of week',
  num_conditions: 'Chronic conditions',
  is_first_visit: 'First visit',
};

async function apiError(res: Response): Promise<Error> {
  const text = await res.text().catch(() => '');

  try {
    const data = JSON.parse(text);

    if (Array.isArray(data?.detail)) {
      const messages = data.detail.map((item: any) => {
        const field = item?.loc?.[item.loc.length - 1];
        const label = FIELD_LABELS[field] || field || 'Input';
        return `${label}: ${item?.msg || 'Invalid value'}`;
      });

      return new Error(messages.join(' • '));
    }

    if (typeof data?.detail === 'string') {
      return new Error(data.detail);
    }
  } catch {
    // Fall through to generic message.
  }

  return new Error(`Request failed (${res.status})`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw await apiError(res);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw await apiError(res);
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
