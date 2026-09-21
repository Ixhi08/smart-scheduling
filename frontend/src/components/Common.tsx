import React from 'react';
import { PatientInput, VisitTypesResponse } from '../types';

export const DEFAULT_PATIENT: PatientInput = {
  visit_type: 'Hypertension Follow-up',
  age: 58,
  insurance_type: 'Medicare',
  provider_type: 'MD',
  day_of_week: 'Monday',
  num_conditions: 2,
  is_first_visit: 0,
  arrived_late_min: 0,
};

export const inputStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxShadow: '0 1px 1px rgba(16,24,40,0.02)',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23667085' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 34,
};

export const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 22,
    boxShadow: '0 1px 2px rgba(16,24,40,0.035)',
    ...style,
  }}>
    {children}
  </div>
);

export const SectionLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span style={{
    fontSize: 12,
    fontWeight: 650,
    color: 'var(--text-dim)',
    letterSpacing: '-0.05px',
  }}>
    {children}
  </span>
);

export const StatBox = ({ label, value, unit, accent, hint }: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  hint?: string;
}) => (
  <div style={{
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '14px 15px',
  }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 550 }}>{label}</div>
    <div style={{ fontSize: 23, fontWeight: 700, color: accent || 'var(--text)', marginTop: 3, letterSpacing: '-0.4px' }}>
      {value}{unit && <span style={{ fontSize: 12, marginLeft: 4, fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>}
    </div>
    {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{hint}</div>}
  </div>
);

const Field = ({ label, children, hint }: React.PropsWithChildren<{ label: string; hint?: string }>) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>{label}</label>
    {children}
    {hint && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</span>}
  </div>
);

export const PatientForm: React.FC<{
  form: PatientInput;
  setForm: React.Dispatch<React.SetStateAction<PatientInput>>;
  meta: VisitTypesResponse | null;
  compact?: boolean;
}> = ({ form, setForm, meta, compact = false }) => {
  const set = (key: keyof PatientInput, value: string | number) => setForm(f => ({ ...f, [key]: value }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 13 : 16 }}>
      <Field label="Visit type">
        <select style={selectStyle} value={form.visit_type} onChange={e => set('visit_type', e.target.value)}>
          {(meta?.visit_types || [DEFAULT_PATIENT.visit_type]).map(v => <option key={v}>{v}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Age">
          <input type="number" style={inputStyle} min={1} max={110} value={form.age} onChange={e => set('age', Number(e.target.value) || 1)} />
        </Field>
        <Field label="Chronic conditions">
          <input type="number" style={inputStyle} min={0} max={10} value={form.num_conditions} onChange={e => set('num_conditions', Number(e.target.value) || 0)} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Insurance">
          <select style={selectStyle} value={form.insurance_type} onChange={e => set('insurance_type', e.target.value)}>
            {(meta?.insurance_types || ['Private', 'Medicare', 'Medicaid', 'Uninsured']).map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Provider">
          <select style={selectStyle} value={form.provider_type} onChange={e => set('provider_type', e.target.value)}>
            {(meta?.provider_types || ['MD', 'DO', 'NP', 'PA']).map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Day of week">
          <select style={selectStyle} value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)}>
            {(meta?.days_of_week || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Late arrival" hint="Minutes">
          <input type="number" style={inputStyle} min={0} max={60} value={form.arrived_late_min} onChange={e => set('arrived_late_min', Number(e.target.value) || 0)} />
        </Field>
      </div>
      <Field label="First visit">
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 0, label: 'Returning' }, { v: 1, label: 'New patient' }].map(opt => (
            <button key={opt.v} onClick={() => set('is_first_visit', opt.v)} style={{
              flex: 1,
              padding: '9px 10px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${form.is_first_visit === opt.v ? 'var(--accent)' : 'var(--border)'}`,
              background: form.is_first_visit === opt.v ? 'var(--accent-soft)' : '#fff',
              color: form.is_first_visit === opt.v ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: 12,
              fontWeight: 600,
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
};

export const formatClock = (minutes: number): string => {
  const total = Math.round(minutes);
  const h24 = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${suffix}`;
};
