import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { SimulationResult, SimAggregate } from '../types';

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

const CLINIC_START = 8 * 60;
const CLINIC_END   = 17 * 60;
const CLINIC_SPAN  = CLINIC_END - CLINIC_START;

function Timeline({ appointments, label, color }: {
  appointments: SimulationResult['fixed']['appointments'];
  label: string; color: string;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
      </div>
      <div style={{ position: 'relative', paddingTop: '8px' }}>
        {/* Time ruler */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {[8, 10, 12, 14, 16].map(h => (
            <span key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
              {h > 12 ? `${h - 12}PM` : h === 12 ? '12PM' : `${h}AM`}
            </span>
          ))}
        </div>
        {/* Track */}
        <div style={{ position: 'relative', height: `${Math.max(appointments.length * 26, 100)}px` }}>
          {appointments.map((appt, i) => {
            const slotStart = ((appt.scheduled_start - CLINIC_START) / CLINIC_SPAN) * 100;
            const slotWidth = (appt.slot_length / CLINIC_SPAN) * 100;
            const actualStart = ((appt.actual_start - CLINIC_START) / CLINIC_SPAN) * 100;
            const actualWidth = (appt.actual_duration / CLINIC_SPAN) * 100;
            const hasOvertime = appt.overtime > 0;
            const y = i * 26;
            return (
              <React.Fragment key={i}>
                {/* Slot */}
                <div style={{
                  position: 'absolute', left: `${Math.max(0, slotStart)}%`, width: `${slotWidth}%`,
                  top: y, height: '20px',
                  background: 'var(--surface2)', border: `1px solid ${color}44`,
                  borderRadius: '4px',
                }} title={`Scheduled: ${minToTime(appt.scheduled_start)} (${appt.slot_length}min)`} />
                {/* Actual */}
                <div style={{
                  position: 'absolute', left: `${Math.max(0, actualStart)}%`, width: `${actualWidth}%`,
                  top: y + 4, height: '12px',
                  background: hasOvertime ? '#ef4444aa' : color + 'cc',
                  borderRadius: '3px',
                }} title={`Actual: ${appt.actual_duration}min${hasOvertime ? ` (+${appt.overtime}min over)` : ''}`} />
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '14px', height: '8px', background: 'var(--surface2)', border: `1px solid ${color}44`, borderRadius: '2px', display: 'inline-block' }} />
            Scheduled slot
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '14px', height: '8px', background: color + 'cc', borderRadius: '2px', display: 'inline-block' }} />
            Actual duration
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '14px', height: '8px', background: '#ef4444aa', borderRadius: '2px', display: 'inline-block' }} />
            Overtime
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCompare({ label, fixed, ai, lowerBetter, unit }: {
  label: string; fixed: number; ai: number; lowerBetter: boolean; unit?: string;
}) {
  const aiWins = lowerBetter ? ai < fixed : ai > fixed;
  const diff = Math.abs(fixed - ai);
  const pct = fixed > 0 ? Math.round((diff / fixed) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ flex: '0 0 180px', fontSize: '13px', color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right' }}>
        {fixed}{unit}
      </span>
      <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: '13px', color: aiWins ? 'var(--accent)' : '#ef4444', fontWeight: 600, textAlign: 'right' }}>
        {ai}{unit}
      </span>
      <span style={{ flex: '0 0 80px', fontSize: '11px', fontWeight: 600, color: aiWins ? 'var(--accent)' : '#ef4444', textAlign: 'right' }}>
        {aiWins ? '↓' : '↑'} {pct}%
      </span>
    </div>
  );
}

export const SimulatePage: React.FC = () => {
  const [result, setResult]   = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [seed, setSeed]       = useState(42);
  const [nPatients, setN]     = useState(15);

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.simulate(nPatients, seed);
      setResult(r);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const barData = result ? [
    { name: 'Avg Wait',       fixed: result.fixed.aggregate.avg_wait_min,       ai: result.ai.aggregate.avg_wait_min },
    { name: 'Total Overtime', fixed: result.fixed.aggregate.total_overtime_min, ai: result.ai.aggregate.total_overtime_min },
    { name: 'Idle Time',      fixed: result.fixed.aggregate.total_idle_min,     ai: result.ai.aggregate.total_idle_min },
  ] : [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Clinic Day Simulation
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Discrete-event simulation comparing fixed 20-minute slots vs AI-predicted slots across a full clinic day.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Patients</label>
          <input type="number" min={5} max={30} value={nPatients} onChange={e => setN(Math.min(30, Math.max(5, +e.target.value)))}
            style={{ width: '60px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--mono)', outline: 'none' }} />
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Seed</label>
          <input type="number" min={0} value={seed} onChange={e => setSeed(+e.target.value)}
            style={{ width: '70px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--mono)', outline: 'none' }} />
          <button onClick={run} disabled={loading} style={{
            padding: '9px 18px', background: 'var(--accent)', color: '#0a0f1e',
            border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* Key headline stat */}
          <div style={{
            background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.25)',
            borderRadius: 'var(--radius-lg)', padding: '20px 28px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '32px',
          }}>
            <div>
              <div style={{ fontSize: '40px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                {result.fixed.aggregate.total_overtime_min}
                <span style={{ fontSize: '16px', fontWeight: 400, marginLeft: '4px' }}>min</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Fixed scheduling overtime</div>
            </div>
            <div style={{ fontSize: '28px', color: 'var(--text-muted)' }}>→</div>
            <div>
              <div style={{ fontSize: '40px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                {result.ai.aggregate.total_overtime_min}
                <span style={{ fontSize: '16px', fontWeight: 400, marginLeft: '4px' }}>min</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>AI scheduling overtime</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                {Math.round(((result.fixed.aggregate.total_overtime_min - result.ai.aggregate.total_overtime_min) / Math.max(result.fixed.aggregate.total_overtime_min, 1)) * 100)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>reduction in daily overtime</div>
            </div>
          </div>

          {/* Timelines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <Timeline appointments={result.fixed.appointments} label="Fixed Slots (20 min)" color="#3b82f6" />
            <Timeline appointments={result.ai.appointments}    label="AI-Predicted Slots"  color="#00d4aa" />
          </div>

          {/* Bar chart + stat comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '16px' }}>
                Key Metrics Comparison (minutes)
              </span>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                  <Bar name="Fixed" dataKey="fixed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar name="AI"    dataKey="ai"    fill="#00d4aa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
              <div style={{ display: 'flex', marginBottom: '8px' }}>
                <span style={{ flex: '0 0 180px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Metric</span>
                <span style={{ flex: 1, fontSize: '11px', color: '#3b82f6', fontWeight: 600, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Fixed</span>
                <span style={{ flex: 1, fontSize: '11px', color: 'var(--accent)', fontWeight: 600, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.8px' }}>AI</span>
                <span style={{ flex: '0 0 80px' }} />
              </div>
              {[
                { label: 'Avg patient wait', fk: 'avg_wait_min',        unit: ' min', lower: true },
                { label: 'Max patient wait', fk: 'max_wait_min',        unit: ' min', lower: true },
                { label: 'Total overtime',   fk: 'total_overtime_min',  unit: ' min', lower: true },
                { label: 'Total idle time',  fk: 'total_idle_min',      unit: ' min', lower: true },
                { label: 'Clinic end',       fk: 'clinic_duration_min', unit: ' min', lower: true },
              ].map(row => (
                <StatCompare key={row.label} label={row.label}
                  fixed={(result.fixed.aggregate as any)[row.fk]}
                  ai={(result.ai.aggregate as any)[row.fk]}
                  lowerBetter={row.lower} unit={row.unit} />
              ))}
            </div>
          </div>

          <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Simulation uses actual durations from held-out patient records. Late arrivals, overtime cascades, and provider idle time are all modeled. Change the seed to test different patient days.
          </p>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
