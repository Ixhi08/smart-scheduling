import React from 'react';
import { Activity } from 'lucide-react';
import type { Page } from '../App';

interface NavProps { page: Page; setPage: (p: Page) => void; }
const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'predict', label: 'Predict' },
  { id: 'explain', label: 'Explain' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'simulate', label: 'Simulation' },
  { id: 'analytics', label: 'Analytics' },
];

export const Nav: React.FC<NavProps> = ({ page, setPage }) => (
  <nav style={{
    background: 'rgba(255,255,255,0.96)',
    borderBottom: '1px solid var(--border)',
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 26,
    height: 56,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    overflowX: 'auto',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 10, whiteSpace: 'nowrap' }}>
      <Activity size={17} color="var(--accent)" strokeWidth={2} />
      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.15px' }}>Smart Scheduling</span>
    </div>
    {NAV_ITEMS.map(item => (
      <button key={item.id} onClick={() => setPage(item.id)} style={{
        background: 'none',
        border: 'none',
        color: page === item.id ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 13,
        fontWeight: page === item.id ? 650 : 500,
        padding: '18px 0 16px',
        borderBottom: page === item.id ? '2px solid var(--accent)' : '2px solid transparent',
        whiteSpace: 'nowrap',
      }}>
        {item.label}
      </button>
    ))}
  </nav>
);
