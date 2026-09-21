import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { api } from '../api';
import { ExplainResult, PatientInput, VisitTypesResponse } from '../types';
import { Card, DEFAULT_PATIENT, PatientForm, SectionLabel, StatBox } from '../components/Common';

const WhatIfChart = ({ title, data, xLabel }: { title: string; data: any[]; xLabel: string }) => (
  <Card>
    <SectionLabel>{title}</SectionLabel>
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 18, right: 8, bottom: 4, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: xLabel, position: 'insideBottomRight', offset: -2, fill: '#64748b', fontSize: 10 }} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
        <Line type="monotone" dataKey="predicted_duration_min" name="Prediction" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="lower" name="90% lower" stroke="#2563eb" strokeDasharray="4 3" dot={false} />
        <Line type="monotone" dataKey="upper" name="90% upper" stroke="#2563eb" strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </Card>
);

export const ExplainPage: React.FC = () => {
  const [form, setForm] = useState<PatientInput>({ ...DEFAULT_PATIENT });
  const [meta, setMeta] = useState<VisitTypesResponse | null>(null);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.visitTypes().then(setMeta).catch(() => {}); }, []);

  const run = async () => {
    setLoading(true); setError('');
    try { setResult(await api.explain(form)); }
    catch { setError('Could not load explanation. The backend may still be waking up.'); }
    finally { setLoading(false); }
  };

  const contributionData = useMemo(() => result?.explanation.contributions.map(c => ({
    name: c.label,
    value: c.impact_min,
    detail: c.value,
  })) || [], [result]);

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '38px 24px 56px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '27px', letterSpacing: '-0.6px', marginBottom: '5px' }}>Explain & What-If Analysis</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Inspect local model sensitivity and change one patient factor at a time without calling the explanation causal.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '370px 1fr', gap: '20px', alignItems: 'start' }}>
        <Card>
          <SectionLabel>Patient Profile</SectionLabel>
          <div style={{ marginTop: 15 }}><PatientForm form={form} setForm={setForm} meta={meta} compact /></div>
          <button onClick={run} disabled={loading} style={{ width: '100%', marginTop: 18, padding: 12, border: 0, borderRadius: 9, background: loading ? 'var(--surface2)' : 'var(--accent)', color: loading ? 'var(--text-muted)' : '#fff', fontWeight: 700 }}>
            {loading ? 'Analyzing…' : 'Explain Prediction'}
          </button>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</div>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {!result ? (
            <Card style={{ minHeight: 430, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <div><Lightbulb size={34} color="var(--border)" /><div style={{ marginTop: 10 }}>Run an explanation to see feature impacts and what-if curves.</div></div>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <StatBox label="Reference Prediction" value={result.explanation.baseline_prediction_min} unit="min" />
                <StatBox label="Patient Prediction" value={result.explanation.final_prediction_min} unit="min" accent="var(--accent)" />
                <StatBox label="Net Difference" value={`${result.explanation.total_delta_min >= 0 ? '+' : ''}${result.explanation.total_delta_min}`} unit="min" accent={result.explanation.total_delta_min >= 0 ? 'var(--warn)' : 'var(--accent2)'} />
              </div>

              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <SectionLabel>Local Sequential Sensitivity</SectionLabel>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>positive = longer predicted visit</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={contributionData} layout="vertical" margin={{ top: 14, right: 20, bottom: 4, left: 75 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(value: any, _name: any, props: any) => [`${Number(value).toFixed(2)} min (${props.payload.detail})`, 'Impact']} />
                    <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                      {contributionData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#f59e0b' : '#2563eb'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: 11, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)', padding: '10px 12px', borderRadius: 8 }}>
                  <AlertTriangle size={14} color="var(--warn)" style={{ flexShrink: 0 }} />
                  <span>{result.explanation.warning}</span>
                </div>
              </Card>

              <div>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>What-if curves</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <WhatIfChart title="Chronic Conditions" data={result.what_if.num_conditions} xLabel="conditions" />
                  <WhatIfChart title="Late Arrival" data={result.what_if.late_arrival_min} xLabel="minutes" />
                  <WhatIfChart title="Age Sensitivity" data={result.what_if.age} xLabel="age" />
                  <WhatIfChart title="First vs Returning" data={result.what_if.first_visit} xLabel="status" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
