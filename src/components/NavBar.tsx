import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const icons: Record<string, ReactNode> = {
  hoje: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16.5 9.5" />
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M16 5h3v1.5A3.5 3.5 0 0 1 16 10M8 5H5v1.5A3.5 3.5 0 0 0 8 10M12 13v4M8.5 20h7M10 17h4" />
    </svg>
  ),
  historico: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  peso: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M8 9.5a5 5 0 0 1 8 0M12 9.5l1.5-1.8" />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  ),
};

const items = [
  { to: '/', icon: 'hoje', label: 'Hoje' },
  { to: '/ranking', icon: 'ranking', label: 'Ranking' },
  { to: '/historico', icon: 'historico', label: 'Histórico' },
  { to: '/peso', icon: 'peso', label: 'Peso' },
  { to: '/config', icon: 'config', label: 'Config' },
];

export default function NavBar() {
  return (
    <nav className="nav" aria-label="Navegação">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden>{icons[i.icon]}</span>
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
