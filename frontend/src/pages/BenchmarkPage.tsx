import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Award } from 'lucide-react';
import { api } from '../api';
import { BenchmarkResult } from '../types';

const COLORS: Record<string, string> = {
  'Neural Network': 'var(--accent)',
  'Random Forest':  'var(--accent2)',
  'XGBoost':        '#a78bfa',
  'KNN':            '#f59e0b',
};

const MetricChart = ({ data, metric, label, unit, lowerBetter }: {
  data: { name: string; value: number; best: boolean }[];
  metric: string; label: string; unit: string; lowerBetter: boolean;
}) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
    <div style={{ marginBottom: '20px' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {label}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({lowerBetter ? 'lower = better' : 'higher = better'})</span>
    </div>
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
          tickFormatter={v => `${v}${unit}`} />
        <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px' }}
          formatter={(v: any) => [`${v}${unit}`, label]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map(entry => (
            <Cell key={entry.name} fill={entry.best ? COLORS[entry.name] || 'var(--accent)' : 'var(--surface2)'}
              stroke={entry.best ? COLORS[entry.name] || 'var(--accent)' : 'var(--border)'} strokeWidth={1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const BenchmarkPage: React.FC = () => {
  const [data, setData]     = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.benchmark().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
      Loading model benchmarks…
    </div>
  );

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#ef4444' }}>
      Failed to load. Is the backend running?
    </div>
  );

  const models = Object.entries(data.models);
  const bestMAE   = Math.min(...models.map(([, m]) => m.mae));
  const bestRMSE  = Math.min(...models.map(([, m]) => m.rmse));
  const bestR2    = Math.max(...models.map(([, m]) => m.r2));

  const maeData   = models.map(([n, m]) => ({ name: n, value: m.mae,  best: m.mae  === bestMAE }));
  const rmseData  = models.map(([n, m]) => ({ name: n, value: m.rmse, best: m.rmse === bestRMSE }));
  const r2Data    = models.map(([n, m]) => ({ name: n, value: +(m.r2 * 100).toFixed(1), best: m.r2 === bestR2 }));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '6px' }}>
          Model Comparison
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Four ML models trained and benchmarked on 2,000 synthetic patient records. Evaluated on held-out 20% test set.
        </p>
      </div>

      {/* Winner callout */}
      <div style={{
        background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.25)',
        borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: '28px',
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <Award size={22} color="var(--accent)" />
        <div>
          <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '15px' }}>{data.best_model}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '14px' }}> is the best-performing model — lowest MAE and highest R².</span>
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-dim)' }}>
          MAE: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{data.models[data.best_model].mae} min</span>
          &nbsp;·&nbsp; R²: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{data.models[data.best_model].r2}</span>
        </div>
      </div>

      {/* Metric charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        <MetricChart data={maeData}  metric="mae"  label="Mean Absolute Error"    unit=" min" lowerBetter />
        <MetricChart data={rmseData} metric="rmse" label="Root Mean Squared Error" unit=" min" lowerBetter />
        <MetricChart data={r2Data}   metric="r2"   label="R² Score (× 100)"       unit="%"    lowerBetter={false} />
      </div>

      {/* Full table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Model', 'MAE (min)', 'RMSE (min)', 'R²', 'Status'].map(h => (
                <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.sort(([, a], [, b]) => a.mae - b.mae).map(([name, metrics]) => {
              const isBest = name === data.best_model;
              return (
                <tr key={name} style={{ borderBottom: '1px solid var(--border)', background: isBest ? 'rgba(0,212,170,0.04)' : 'transparent', transition: 'background 0.1s' }}>
                  <td style={{ padding: '14px 20px', fontWeight: isBest ? 600 : 400, color: isBest ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[name] || 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
                    {name}
                  </td>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: metrics.mae === bestMAE ? 'var(--accent)' : 'var(--text-dim)' }}>{metrics.mae}</td>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: metrics.rmse === bestRMSE ? 'var(--accent)' : 'var(--text-dim)' }}>{metrics.rmse}</td>
                  <td style={{ padding: '14px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: metrics.r2 === bestR2 ? 'var(--accent)' : 'var(--text-dim)' }}>{metrics.r2}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                      background: isBest ? 'rgba(0,212,170,0.12)' : 'var(--surface2)',
                      color: isBest ? 'var(--accent)' : 'var(--text-muted)',
                      border: `1px solid ${isBest ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
                    }}>
                      {isBest ? 'Deployed' : 'Evaluated'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        MAE = average prediction error in minutes · RMSE = penalizes larger errors more · R² = variance explained by model (0–1)
      </p>
    </div>
  );
};
