import React from 'react';
import { Appointment } from '../types';
import { Card, formatClock, SectionLabel } from './Common';

export const ScheduleTimeline: React.FC<{
  appointments: Appointment[];
  label: string;
  color: string;
  clinicStart: number;
  clinicEnd: number;
  maxRows?: number;
}> = ({ appointments, label, color, clinicStart, clinicEnd, maxRows = 30 }) => {
  const maxEnd = Math.max(clinicEnd, ...appointments.map(a => Math.max(a.scheduled_end, a.actual_end)));
  const span = Math.max(1, maxEnd - clinicStart);
  const rows = appointments.slice(0, maxRows);
  return (
    <Card style={{ padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <SectionLabel>{label}</SectionLabel>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatClock(clinicStart)} → {formatClock(maxEnd)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((a, i) => {
          const scheduledLeft = ((a.scheduled_start - clinicStart) / span) * 100;
          const scheduledWidth = ((a.scheduled_end - a.scheduled_start) / span) * 100;
          const actualLeft = ((a.actual_start - clinicStart) / span) * 100;
          const actualWidth = ((a.actual_end - a.actual_start) / span) * 100;
          return (
            <div key={`${a.patient_idx}-${i}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{i + 1}</span>
              <div style={{ height: 18, position: 'relative', background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }} title={`${a.visit_type}\nScheduled ${formatClock(a.scheduled_start)} (${a.slot_length} min)\nActual ${formatClock(a.actual_start)}–${formatClock(a.actual_end)}\nWait ${a.wait_time} min`}>
                <div style={{ position: 'absolute', left: `${scheduledLeft}%`, width: `${Math.max(scheduledWidth, 0.7)}%`, top: 3, height: 12, border: `1px solid ${color}`, opacity: 0.6, borderRadius: 3 }} />
                <div style={{ position: 'absolute', left: `${actualLeft}%`, width: `${Math.max(actualWidth, 0.7)}%`, top: 6, height: 6, background: color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 15, marginTop: 11, color: 'var(--text-muted)', fontSize: 10 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 8, border: `1px solid ${color}`, marginRight: 5 }} />Booked slot</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 5, background: color, marginRight: 5 }} />Actual service</span>
      </div>
    </Card>
  );
};
