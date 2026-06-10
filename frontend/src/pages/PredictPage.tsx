import React, { useEffect, useState } from 'react';
import { Clock, TrendingDown, AlertCircle, ChevronDown } from 'lucide-react';
import { api } from '../api';
import { PatientInput, PredictionResult, VisitTypesResponse } from '../types';

const DEFAULTS: PatientInput = {
  visit_type:       'Hypertension Follow-up',
  age:              58,
  insurance_type:   'Medicare',
  provider_type:    'MD',
  day_of_week:      'Monday',
  num_conditions:   2,
  is_first_visit:   0,
  arrived_late_min: 0,
};

const field = (label: string, node: React.ReactNode, hint?: string) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
      {label}
    </label>
    {node}
    {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</span>}
  </div>
);

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  padding: '10px 14px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: '36px',
  cursor: 'pointer',
};

function StatBox({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent?: string }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${accent ? accent + '33' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
      <span style={{ fontSize: '26px', fontWeight: 700, color: accent || 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '3px', color: accent || 'var(--text-dim)' }}>{unit}</span>
      </span>
    </div>
  );
}

export const PredictPage: React.FC = () => {
  const [form, setForm]       = useState<PatientInput>(DEFAULTS);
  const [result, setResult]   = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [meta, setMeta]       = useState<VisitTypesResponse | null>(null);

  useEffect(() => { api.visitTypes().then(setMeta).catch(() => {}); }, []);

  const set = (k: keyof PatientInput, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await api.predict(form);
      setResult(r);
    } catch (e) {
      setError('Could not reach the API. Make sure the backend is running on port 8000.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '6px' }}>
          Appointment Duration Predictor
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Enter patient details to get an AI-predicted appointment length and recommended time slot.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Patient Info</span>

          {field('Visit Type',
            <select style={selectStyle} value={form.visit_type} onChange={e => set('visit_type', e.target.value)}>
              {(meta?.visit_types || [DEFAULTS.visit_type]).map(v => <option key={v}>{v}</option>)}
            </select>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {field('Age',
              <input type="number" style={inputStyle} min={1} max={110} value={form.age}
                onChange={e => set('age', parseInt(e.target.value) || 0)} />
            )}
            {field('Active Conditions',
              <input type="number" style={inputStyle} min={0} max={10} value={form.num_conditions}
                onChange={e => set('num_conditions', parseInt(e.target.value) || 0)} />,
              'Chronic diagnoses'
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {field('Insurance',
              <select style={selectStyle} value={form.insurance_type} onChange={e => set('insurance_type', e.target.value)}>
                {(meta?.insurance_types || ['Private','Medicare','Medicaid','Uninsured']).map(v => <option key={v}>{v}</option>)}
              </select>
            )}
            {field('Provider',
              <select style={selectStyle} value={form.provider_type} onChange={e => set('provider_type', e.target.value)}>
                {(meta?.provider_types || ['MD','DO','NP','PA']).map(v => <option key={v}>{v}</option>)}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {field('Day of Week',
              <select style={selectStyle} value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)}>
                {(meta?.days_of_week || ['Monday','Tuesday','Wednesday','Thursday','Friday']).map(v => <option key={v}>{v}</option>)}
              </select>
            )}
            {field('Arrived Late',
              <input type="number" style={inputStyle} min={0} max={60} step={1} value={form.arrived_late_min}
                onChange={e => set('arrived_late_min', parseFloat(e.target.value) || 0)} />,
              'Minutes late (0 if on time)'
            )}
          </div>

          {field('First Visit?',
            <div style={{ display: 'flex', gap: '10px' }}>
              {[{ v: 0, label: 'No' }, { v: 1, label: 'Yes — new patient' }].map(opt => (
                <button key={opt.v} onClick={() => set('is_first_visit', opt.v)} style={{
                  flex: 1, padding: '10px', borderRadius: 'var(--radius)',
                  border: `1px solid ${form.is_first_visit === opt.v ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.is_first_visit === opt.v ? 'rgba(0,212,170,0.1)' : 'var(--surface2)',
                  color: form.is_first_visit === opt.v ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 500, fontSize: '13px', transition: 'all 0.15s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            marginTop: '8px', padding: '13px', borderRadius: 'var(--radius)',
            background: loading ? 'var(--surface2)' : 'var(--accent)',
            color: loading ? 'var(--text-muted)' : '#0a0f1e',
            border: 'none', fontWeight: 700, fontSize: '14px', letterSpacing: '0.3px',
            transition: 'background 0.15s',
          }}>
            {loading ? 'Predicting…' : 'Predict Appointment Duration'}
          </button>

          {error && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#ef4444', fontSize: '13px', background: 'rgba(239,68,68,0.08)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />{error}
            </div>
          )}
        </div>

        {/* Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!result ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '60px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', textAlign: 'center', height: '100%', justifyContent: 'center' }}>
              <Clock size={36} strokeWidth={1.5} color="var(--border)" />
              <span style={{ fontSize: '14px' }}>Fill in patient details and click Predict</span>
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Prediction Result</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '3px 8px', borderRadius: '6px' }}>
                    {result.model_used}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <StatBox label="Predicted Duration" value={result.predicted_duration_min} unit="min" accent="var(--accent2)" />
                  <StatBox label="Recommended Slot" value={result.recommended_slot_min} unit="min" accent="var(--accent)" />
                  <StatBox label="Traditional Slot" value={result.traditional_slot_min} unit="min" />
                  <StatBox label="Time Saved" value={result.time_saved_pct > 0 ? `${result.time_saved_pct}%` : '—'} accent={result.time_saved_pct > 0 ? 'var(--accent)' : undefined} />
                </div>
              </div>

              {/* Confidence interval bar */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '14px' }}>
                  Confidence Range (±1 MAE)
                </span>
                <div style={{ position: 'relative', height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${(result.confidence_interval[0] / 75) * 100}%`,
                    width: `${((result.confidence_interval[1] - result.confidence_interval[0]) / 75) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent2), var(--accent))',
                    borderRadius: '4px',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
                  <span>{result.confidence_interval[0]} min</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{result.predicted_duration_min} min</span>
                  <span>{result.confidence_interval[1]} min</span>
                </div>
              </div>

              {/* Complexity */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Visit Complexity</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--warn)', fontWeight: 600 }}>
                    {(result.complexity_score * 10).toFixed(1)} / 10
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${result.complexity_score * 100}%`, height: '100%', background: 'var(--warn)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
