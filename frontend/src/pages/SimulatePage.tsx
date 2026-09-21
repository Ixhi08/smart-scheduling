import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Play, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { SimulationRequest, SimulationResult, StrategyResult, VisitTypesResponse } from '../types';
import { Card, inputStyle, SectionLabel, selectStyle, StatBox } from '../components/Common';
import { ScheduleTimeline } from '../components/ScheduleTimeline';

const DEFAULT_REQUEST: SimulationRequest = {
  n_patients: 16,
  seed: 42,
  preset: 'Primary Care',
  clinic_start_hour: 8,
  clinic_end_hour: 17,
  lunch_start_hour: 12,
  lunch_duration_min: 60,
  closing_buffer_min: 30,
  allow_reordering: true,
};

const StrategySummary = ({ strategy, accent }: { strategy: StrategyResult; accent: string }) => (
  <Card style={{ borderColor: accent + '44' }}>
    <div style={{ fontWeight: 700, color: accent, marginBottom: 12 }}>{strategy.name}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <StatBox label="Avg Wait" value={strategy.aggregate.avg_wait_min} unit="min" />
      <StatBox label="Clinic Overtime" value={strategy.aggregate.clinic_overtime_min} unit="min" />
      <StatBox label="Duration Overrun" value={strategy.aggregate.total_duration_overrun_min} unit="min" />
      <StatBox label="On-time Starts" value={strategy.aggregate.on_time_start_pct} unit="%" />
    </div>
  </Card>
);

export const SimulatePage: React.FC = () => {
  const [req, setReq] = useState<SimulationRequest>({ ...DEFAULT_REQUEST });
  const [meta, setMeta] = useState<VisitTypesResponse | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.visitTypes().then(setMeta).catch(() => {}); }, []);
  const run = async () => {
    setLoading(true); setError('');
    try { setResult(await api.simulate(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Simulation failed.'); }
    finally { setLoading(false); }
  };

  const chartData = result ? [
    { metric: 'Avg Wait', Fixed: result.fixed.aggregate.avg_wait_min, Adaptive: result.adaptive.aggregate.avg_wait_min, Optimized: result.optimized.aggregate.avg_wait_min },
    { metric: 'Duration Overrun', Fixed: result.fixed.aggregate.total_duration_overrun_min, Adaptive: result.adaptive.aggregate.total_duration_overrun_min, Optimized: result.optimized.aggregate.total_duration_overrun_min },
    { metric: 'Provider Idle', Fixed: result.fixed.aggregate.total_provider_idle_min, Adaptive: result.adaptive.aggregate.total_provider_idle_min, Optimized: result.optimized.aggregate.total_provider_idle_min },
    { metric: 'Clinic OT', Fixed: result.fixed.aggregate.clinic_overtime_min, Adaptive: result.adaptive.aggregate.clinic_overtime_min, Optimized: result.optimized.aggregate.clinic_overtime_min },
  ] : [];

  return (
    <div style={{ maxWidth: 1220, margin: '0 auto', padding: '38px 24px 56px' }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 27, letterSpacing: '-0.6px', marginBottom: 5 }}>Clinic Simulation</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Compare three schedules on the same synthetic clinic day. All appointment start times are booked before actual durations are revealed.
        </p>
      </div>

      <Card style={{ marginBottom: 18, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', flex: '1 1 190px' }}>SCENARIO
            <select style={{ ...selectStyle, marginTop: 5 }} value={req.preset} onChange={e => setReq(r => ({ ...r, preset: e.target.value }))}>
              {(meta?.scenario_presets || ['Primary Care','Pediatrics','Cardiology','Urgent Care']).map(v => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', width: 95 }}>PATIENTS
            <input style={{ ...inputStyle, marginTop: 5 }} type="number" min={5} max={30} value={req.n_patients} onChange={e => setReq(r => ({ ...r, n_patients: Number(e.target.value) }))} />
          </label>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', width: 95 }}>SEED
            <input style={{ ...inputStyle, marginTop: 5 }} type="number" min={0} value={req.seed} onChange={e => setReq(r => ({ ...r, seed: Number(e.target.value) }))} />
          </label>
          <button onClick={run} disabled={loading} style={{ height: 41, padding: '0 18px', border: 0, borderRadius: 9, background: loading ? 'var(--surface2)' : 'var(--accent)', color: loading ? 'var(--text-muted)' : '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}{loading ? 'Running…' : 'Run Simulation'}
          </button>
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 9 }}>{error}</div>}
      </Card>

      {!result ? (
        <Card style={{ minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>Run a clinic day to compare scheduling strategies.</Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
            <StrategySummary strategy={result.fixed} accent="#2563eb" />
            <StrategySummary strategy={result.adaptive} accent="#a78bfa" />
            <StrategySummary strategy={result.optimized} accent="#0f766e" />
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><SectionLabel>Metric Comparison</SectionLabel><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>minutes unless otherwise noted</span></div>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={chartData} margin={{ top: 4, right: 10, bottom: 0, left: -5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Fixed" fill="#2563eb" radius={[4,4,0,0]} />
                <Bar dataKey="Adaptive" fill="#a78bfa" radius={[4,4,0,0]} />
                <Bar dataKey="Optimized" fill="#0f766e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <ScheduleTimeline appointments={result.fixed.appointments} label="Fixed 20-minute Slots" color="#2563eb" clinicStart={result.clinic.start_min} clinicEnd={result.clinic.end_min} />
            <ScheduleTimeline appointments={result.adaptive.appointments} label="Conformal Adaptive Slots" color="#a78bfa" clinicStart={result.clinic.start_min} clinicEnd={result.clinic.end_min} />
            <ScheduleTimeline appointments={result.optimized.appointments} label="Optimized Robust Schedule" color="#0f766e" clinicStart={result.clinic.start_min} clinicEnd={result.clinic.end_min} />
          </div>

          <div style={{ marginTop: 14, padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-muted)', fontSize: 11 }}>
            {result.methodology_note}
          </div>
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
