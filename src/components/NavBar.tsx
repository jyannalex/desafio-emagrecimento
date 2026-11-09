import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', icon: '✅', label: 'Hoje' },
  { to: '/ranking', icon: '🏆', label: 'Ranking' },
  { to: '/historico', icon: '📅', label: 'Histórico' },
  { to: '/peso', icon: '⚖️', label: 'Peso' },
  { to: '/config', icon: '⚙️', label: 'Config' },
];

export default function NavBar() {
  return (
    <nav className="nav">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden>{i.icon}</span>
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
