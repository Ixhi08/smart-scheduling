import React, { useEffect, useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { PatientInput, PredictionResult, VisitTypesResponse } from '../types';
import { Card, DEFAULT_PATIENT, PatientForm, SectionLabel, StatBox } from '../components/Common';

export const PredictPage: React.FC = () => {
  const [form, setForm] = useState<PatientInput>({ ...DEFAULT_PATIENT });
  const [meta, setMeta] = useState<VisitTypesResponse | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.visitTypes().then(setMeta).catch(() => {}); }, []);

  const run = async () => {
    setError('');

    const ageRange = meta?.visit_type_age_ranges?.[form.visit_type] || [1, 110];

    if (form.age < ageRange[0] || form.age > ageRange[1]) {
      setResult(null);
      setError(`Age must be between ${ageRange[0]} and ${ageRange[1]} for this visit type.`);
      return;
    }

    if (form.num_conditions < 0 || form.num_conditions > 4) {
      setResult(null);
      setError('Chronic conditions must be between 0 and 4.');
      return;
    }

    setLoading(true);

    try {
      const prediction = await api.predict(form);
      setResult(prediction);
    } catch (err) {
      setResult(null);

      const message = err instanceof Error ? err.message : '';

      if (
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('Load failed')
      ) {
        setError('Could not reach the prediction API. The backend may still be waking up.');
      } else {
        setError(message || 'Prediction request failed. Please check the inputs and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const uncertaintyColor = result?.uncertainty_level === 'Low'
    ? 'var(--accent)'
    : result?.uncertainty_level === 'Moderate' ? 'var(--warn)' : '#b45309';

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '42px 24px 64px' }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 30, lineHeight: 1.2, letterSpacing: '-0.8px', marginBottom: 8, fontWeight: 720 }}>Appointment duration</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 620 }}>
          Predict visit length and generate an uncertainty-aware scheduling recommendation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 22, alignItems: 'start' }}>
        <Card>
          <SectionLabel>Patient details</SectionLabel>
          <div style={{ marginTop: 16 }}><PatientForm form={form} setForm={setForm} meta={meta} /></div>
          <button onClick={run} disabled={loading} style={{
            width: '100%',
            marginTop: 20,
            padding: '10px 14px',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            background: loading ? 'var(--surface2)' : 'var(--accent)',
            color: loading ? 'var(--text-muted)' : '#fff',
            fontWeight: 650,
            fontSize: 13,
            boxShadow: loading ? 'none' : '0 1px 2px rgba(15,118,110,0.16)',
          }}>{loading ? 'Calculating…' : 'Predict duration →'}</button>
          {error && <div style={{ marginTop: 12, color: '#b42318', fontSize: 12, display: 'flex', gap: 7 }}><AlertCircle size={14} />{error}</div>}
        </Card>

        {!result ? (
          <Card style={{ minHeight: 250 }}>
            <SectionLabel>Prediction</SectionLabel>
            <div style={{ marginTop: 26, padding: '28px 0 18px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>No prediction yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>Enter the patient details and run a prediction. Results will appear here.</div>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <SectionLabel>Prediction</SectionLabel>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{result.model_used}</span>
              </div>

              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 42, lineHeight: 1, fontWeight: 730, letterSpacing: '-1.5px', color: 'var(--text)' }}>{result.predicted_duration_min}</span>
                  <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 550 }}>minutes</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 7 }}>Estimated visit duration</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <StatBox label="Recommended slot" value={result.recommended_slot_min} unit="min" accent="var(--accent)" />
                <StatBox label="90% range" value={`${result.prediction_interval[0]}–${result.prediction_interval[1]}`} unit="min" />
                <StatBox label="Uncertainty" value={result.uncertainty_level} accent={uncertaintyColor} hint={`q̂ = ${result.conformal_qhat_min} min`} />
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><ShieldCheck size={15} color="var(--accent)" /><SectionLabel>Calibrated interval</SectionLabel></div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(result.empirical_coverage * 100).toFixed(1)}% held-out coverage</span>
              </div>
              <div style={{ position: 'relative', height: 8, background: 'var(--surface2)', borderRadius: 999 }}>
                <div style={{
                  position: 'absolute', height: '100%', borderRadius: 999,
                  left: `${result.prediction_interval[0] / 75 * 100}%`,
                  width: `${(result.prediction_interval[1] - result.prediction_interval[0]) / 75 * 100}%`,
                  background: 'var(--accent)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8, color: 'var(--text-muted)' }}>
                <span>{result.prediction_interval[0]} min</span><span style={{ color: 'var(--text)', fontWeight: 650 }}>{result.predicted_duration_min} min</span><span>{result.prediction_interval[1]} min</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 13 }}>{result.recommended_slot_basis}.</p>
            </Card>

            <Card>
              <SectionLabel>Scheduling note</SectionLabel>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 9, lineHeight: 1.65 }}>
                A <b style={{ color: 'var(--text)' }}>{result.recommended_slot_min}-minute</b> slot covers the calibrated upper range and is {Math.abs(result.slot_adjustment_min)} minutes {result.slot_adjustment_min >= 0 ? 'longer' : 'shorter'} than a fixed 20-minute slot.
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
