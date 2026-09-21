import React, { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Award, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { BenchmarkResult } from '../types';
import { Card, SectionLabel, StatBox } from '../components/Common';

const COLORS: Record<string, string> = {
  'Neural Network': '#0f766e',
  'Random Forest': '#2563eb',
  'XGBoost': '#a78bfa',
  'KNN': '#f59e0b',
};

export const BenchmarkPage: React.FC = () => {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.benchmark().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>Loading model analytics…</div>;
  if (!data) return <div style={{ padding: 80, textAlign: 'center', color: '#ef4444' }}>Could not load benchmark data.</div>;

  const models = Object.entries(data.models);
  const selected = data.models[data.best_model];
  const metricData = models.map(([name, m]) => ({ name, mae: m.test_mae, rmse: m.test_rmse, r2: +(m.test_r2 * 100).toFixed(1) }));
  const importance = data.analytics.feature_importance.map(d => ({ ...d, label: d.feature.replaceAll('_', ' ') }));
  const visitError = [...data.analytics.error_by_visit_type].sort((a, b) => b.mae - a.mae);

  return (
    <div style={{ maxWidth: 1220, margin: '0 auto', padding: '38px 24px 56px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 27, letterSpacing: '-0.6px', marginBottom: 5 }}>Model Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Model selection uses cross-validation on training data only; calibration and final test data remain disjoint.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card style={{ background: 'rgba(15,118,110,0.045)', borderColor: 'rgba(15,118,110,0.20)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Award color="var(--accent)" size={21} /><div><div style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.best_model}</div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Selected by 5-fold CV MAE: {selected.cv_mae_mean} ± {selected.cv_mae_std} min</div></div></div>
        </Card>
        <Card style={{ background: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.25)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><ShieldCheck color="var(--accent2)" size={21} /><div><div style={{ fontWeight: 700, color: 'var(--accent2)' }}>90% Nominal Mondrian Conformal</div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Held-out coverage: {(data.conformal.test_empirical_coverage * 100).toFixed(1)}% · nominal 90% target · visit-type calibrated with global fallback</div></div></div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <StatBox label="Final Test MAE" value={selected.test_mae} unit="min" />
        <StatBox label="Final Test RMSE" value={selected.test_rmse} unit="min" />
        <StatBox label="Final Test R²" value={selected.test_r2} accent="var(--accent)" />
        <StatBox label="Avg 90% Interval Width" value={data.conformal.test_avg_interval_width_min} unit="min" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card>
          <SectionLabel>Final Test Model Comparison</SectionLabel>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={metricData} margin={{ top: 15, right: 5, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="mae" name="MAE (min)" radius={[4,4,0,0]}>
                {metricData.map(d => <Cell key={d.name} fill={COLORS[d.name] || '#64748b'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Predicted vs Actual — Final Test</SectionLabel>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 15, right: 15, bottom: 5, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="actual" name="Actual" unit="m" domain={[5,75]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis type="number" dataKey="predicted" name="Predicted" unit="m" domain={[5,75]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine segment={[{ x: 5, y: 5 }, { x: 75, y: 75 }]} stroke="#64748b" strokeDasharray="4 4" />
              <Scatter data={data.analytics.test_points} fill="#0f766e" fillOpacity={0.55} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card>
          <SectionLabel>Permutation Feature Importance</SectionLabel>
          <p style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 5 }}>Increase in test MAE after permuting each original input feature.</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={importance} layout="vertical" margin={{ top: 12, right: 12, bottom: 0, left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} />
              <YAxis type="category" dataKey="label" width={105} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="importance_mean" name="MAE increase" fill="#0f766e" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Residual Distribution</SectionLabel>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.analytics.residual_histogram.map(b => ({ label: `${b.bin_start.toFixed(0)}–${b.bin_end.toFixed(0)}`, count: b.count }))} margin={{ top: 12, right: 8, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 8 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" fill="#2563eb" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.65fr', gap: 14, marginBottom: 14 }}>
        <Card>
          <SectionLabel>Error by Visit Type</SectionLabel>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={visitError} layout="vertical" margin={{ top: 12, right: 10, bottom: 0, left: 135 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis type="category" dataKey="group" width={150} tick={{ fill: 'var(--text-dim)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="mae" name="MAE (min)" fill="#a78bfa" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Error by Age Group</SectionLabel>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={data.analytics.error_by_age_group} margin={{ top: 12, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="group" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="mae" name="MAE (min)" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card>
          <SectionLabel>Subgroup Audit — Insurance Type</SectionLabel>
          <p style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 5 }}>{data.analytics.subgroup_audit_note}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.analytics.error_by_insurance_type} margin={{ top: 12, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="group" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="mae" name="MAE (min)" fill="#64748b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionLabel>Subgroup Audit Summary</SectionLabel>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatBox label="Insurance MAE gap" value={data.analytics.insurance_mae_gap_min ?? '—'} unit={data.analytics.insurance_mae_gap_min == null ? undefined : 'min'} />
            <StatBox label="Model uses insurance" value="No" accent="var(--accent)" />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.55, marginTop: 14 }}>
            This is a synthetic subgroup performance check, not evidence of real-world fairness or clinical equity.
          </p>
        </Card>
      </div>

      <Card>
        <SectionLabel>Full Model Table</SectionLabel>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr>{['Model','CV MAE','Test MAE','Test RMSE','Test R²','Status'].map(h => <th key={h} style={{ textAlign: 'left', padding: '9px 8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>{models.sort(([,a],[,b]) => a.cv_mae_mean - b.cv_mae_mean).map(([name,m]) => <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: 8, color: name === data.best_model ? 'var(--accent)' : 'var(--text)' }}>{name}</td><td style={{ padding: 8 }}>{m.cv_mae_mean} ± {m.cv_mae_std}</td><td style={{ padding: 8 }}>{m.test_mae}</td><td style={{ padding: 8 }}>{m.test_rmse}</td><td style={{ padding: 8 }}>{m.test_r2}</td><td style={{ padding: 8 }}>{name === data.best_model ? 'Deployed' : 'Evaluated'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Card>

      <p style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 10 }}>
        Split: {data.split.train_size} train · {data.split.calibration_size} calibration · {data.split.test_size} final test. Test data is not used for model selection or conformal calibration.
      </p>
    </div>
  );
};
