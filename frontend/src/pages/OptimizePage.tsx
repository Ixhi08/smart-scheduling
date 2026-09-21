import React, { useEffect, useState } from 'react';
import { AlertTriangle, Play, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';
import { SimulationRequest, SimulationResult, VisitTypesResponse } from '../types';
import { Card, formatClock, inputStyle, SectionLabel, selectStyle, StatBox } from '../components/Common';
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

export const OptimizePage: React.FC = () => {
  const [req, setReq] = useState<SimulationRequest>({ ...DEFAULT_REQUEST });
  const [meta, setMeta] = useState<VisitTypesResponse | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.visitTypes().then(setMeta).catch(() => {}); }, []);
  const set = <K extends keyof SimulationRequest>(key: K, value: SimulationRequest[K]) => setReq(r => ({ ...r, [key]: value }));
  const run = async () => {
    setLoading(true); setError('');
    try { setResult(await api.simulate(req)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Optimization failed.'); }
    finally { setLoading(false); }
  };

  const opt = result?.optimization;
  const agg = result?.optimized.aggregate;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '38px 24px 56px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 27, letterSpacing: '-0.6px', marginBottom: 5 }}>Schedule Optimizer</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Allocate uncertainty-aware appointment slots under clinic capacity using a discrete buffer-allocation objective, with optional prediction-only risk-first ordering.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}><SlidersHorizontal size={15} color="var(--accent)" /><SectionLabel>Clinic Constraints</SectionLabel></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scenario preset
              <select style={{ ...selectStyle, marginTop: 5 }} value={req.preset} onChange={e => set('preset', e.target.value)}>
                {(meta?.scenario_presets || ['Primary Care', 'Pediatrics', 'Cardiology', 'Urgent Care']).map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Patients
                <input style={{ ...inputStyle, marginTop: 5 }} type="number" min={5} max={30} value={req.n_patients} onChange={e => set('n_patients', Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Seed
                <input style={{ ...inputStyle, marginTop: 5 }} type="number" min={0} value={req.seed} onChange={e => set('seed', Number(e.target.value))} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clinic start
                <input style={{ ...inputStyle, marginTop: 5 }} type="number" step={0.5} min={0} max={23.5} value={req.clinic_start_hour} onChange={e => set('clinic_start_hour', Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clinic end
                <input style={{ ...inputStyle, marginTop: 5 }} type="number" step={0.5} min={0.5} max={24} value={req.clinic_end_hour} onChange={e => set('clinic_end_hour', Number(e.target.value))} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lunch start
                <input style={{ ...inputStyle, marginTop: 5 }} type="number" step={0.5} min={0} max={23.5} value={req.lunch_start_hour} onChange={e => set('lunch_start_hour', Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lunch minutes
                <input style={{ ...inputStyle, marginTop: 5 }} type="number" min={0} max={180} value={req.lunch_duration_min} onChange={e => set('lunch_duration_min', Number(e.target.value))} />
              </label>
            </div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Closing buffer (minutes)
              <input style={{ ...inputStyle, marginTop: 5 }} type="number" min={0} max={120} value={req.closing_buffer_min} onChange={e => set('closing_buffer_min', Number(e.target.value))} />
            </label>
            <button onClick={() => set('allow_reordering', !req.allow_reordering)} style={{
              padding: '10px 12px', borderRadius: 9, border: `1px solid ${req.allow_reordering ? 'var(--accent)' : 'var(--border)'}`,
              background: req.allow_reordering ? 'rgba(15,118,110,0.08)' : 'var(--surface2)', color: req.allow_reordering ? 'var(--accent)' : 'var(--text-dim)', textAlign: 'left', fontSize: 12,
            }}>
              {req.allow_reordering ? '✓' : '○'} Risk-first ordering heuristic
            </button>
            <button onClick={run} disabled={loading} style={{ padding: 12, border: 0, borderRadius: 9, background: loading ? 'var(--surface2)' : 'var(--accent)', color: loading ? 'var(--text-muted)' : '#fff', fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 7 }}>
              {loading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={15} />}
              {loading ? 'Optimizing…' : 'Build Optimized Schedule'}
            </button>
            {error && <div style={{ color: '#ef4444', fontSize: 11 }}>{error}</div>}
          </div>
        </Card>

        {!result || !opt || !agg ? (
          <Card style={{ minHeight: 470, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
            Configure the clinic and build a robust schedule.
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              <StatBox label="Available Slot Capacity" value={opt.capacity_min} unit="min" hint={`${result.clinic.closing_buffer_min}m closing reserve`} />
              <StatBox label="Requested Robust Time" value={opt.desired_total_min} unit="min" />
              <StatBox label="Allocated" value={opt.allocated_total_min} unit="min" accent="var(--accent)" />
              <StatBox label="Buffer Reduced" value={opt.buffer_compressed_min} unit="min" accent={opt.buffer_compressed_min > 0 ? 'var(--warn)' : 'var(--accent2)'} />
            </div>

            {!opt.capacity_feasible && (
              <div style={{ display: 'flex', gap: 9, padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text-dim)', fontSize: 12 }}>
                <AlertTriangle size={16} color="var(--warn)" /> Point-prediction slots alone exceed clinic capacity by {opt.scheduled_over_capacity_min} minutes, so the optimizer refuses to compress below predicted durations.
              </div>
            )}

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><SectionLabel>Optimization Method</SectionLabel><div style={{ marginTop: 7, fontSize: 13 }}>{opt.method}</div></div>
                <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>Ordering<br /><b style={{ color: 'var(--text-dim)' }}>{opt.ordering}</b></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 17 }}>
                <StatBox label="Avg Wait" value={agg.avg_wait_min} unit="min" />
                <StatBox label="Clinic Overtime" value={agg.clinic_overtime_min} unit="min" />
                <StatBox label="Duration Overrun" value={agg.total_duration_overrun_min} unit="min" />
                <StatBox label="On-time Starts" value={agg.on_time_start_pct} unit="%" />
              </div>
            </Card>

            <ScheduleTimeline appointments={result.optimized.appointments} label="Optimized Clinic Timeline" color="#0f766e" clinicStart={result.clinic.start_min} clinicEnd={result.clinic.end_min} />

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><SectionLabel>Optimized Appointment Plan</SectionLabel><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{result.scenario_preset}</span></div>
              <div style={{ overflowX: 'auto', maxHeight: 330, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr>{['#','Visit','Start','Slot','Prediction','90% Upper','Actual','Wait'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 7px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>{h}</th>)}</tr></thead>
                  <tbody>{result.optimized.appointments.map((a, i) => <tr key={`${a.patient_idx}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 7 }}>{i + 1}</td><td style={{ padding: 7 }}>{a.visit_type}</td><td style={{ padding: 7, fontFamily: 'var(--mono)' }}>{formatClock(a.scheduled_start)}</td><td style={{ padding: 7 }}>{a.slot_length}m</td><td style={{ padding: 7 }}>{a.predicted_duration}m</td><td style={{ padding: 7 }}>{a.interval_upper}m</td><td style={{ padding: 7 }}>{a.actual_duration}m</td><td style={{ padding: 7 }}>{a.wait_time}m</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
