import React from 'react';
import { Activity } from 'lucide-react';

type Page = 'predict' | 'benchmark' | 'simulate';

interface NavProps { page: Page; setPage: (p: Page) => void; }

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'predict',   label: 'Predict' },
  { id: 'benchmark', label: 'Model Comparison' },
  { id: 'simulate',  label: 'Clinic Simulation' },
];

export const Nav: React.FC<NavProps> = ({ page, setPage }) => (
  <nav style={{
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
    height: '58px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '16px' }}>
      <Activity size={18} color="var(--accent)" />
      <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: 'var(--text)' }}>
        Smart Scheduling
      </span>
    </div>
    {NAV_ITEMS.map(item => (
      <button key={item.id} onClick={() => setPage(item.id)} style={{
        background: 'none',
        border: 'none',
        color: page === item.id ? 'var(--accent)' : 'var(--text-dim)',
        fontSize: '13px',
        fontWeight: page === item.id ? 600 : 400,
        padding: '0 0 2px',
        borderBottom: page === item.id ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'color 0.15s, border-color 0.15s',
        cursor: 'pointer',
      }}>
        {item.label}
      </button>
    ))}
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        background: 'rgba(0,212,170,0.1)',
        color: 'var(--accent)',
        fontSize: '11px',
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: '20px',
        border: '1px solid rgba(0,212,170,0.25)',
        fontFamily: 'var(--mono)',
        letterSpacing: '0.5px',
      }}>
        LIVE
      </span>
    </div>
  </nav>
);
