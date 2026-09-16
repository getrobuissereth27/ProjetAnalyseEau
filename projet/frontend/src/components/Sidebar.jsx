import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import SelecteurSite from './SelecteurSite';

const LIENS = [
  { to: '/', label: 'Tableau de bord', fin: true },
  { to: '/historique', label: 'Historique' },
  { to: '/alertes', label: 'Alertes' },
  { to: '/parametres', label: 'Paramètres (admin)', adminSeulement: true },
  { to: '/utilisateurs', label: 'Utilisateurs (admin)', adminSeulement: true },
  { to: '/notifications', label: 'Alertes email (admin)', adminSeulement: true },
];

export default function Sidebar({ onNavigate }) {
  const { utilisateur } = useAuth();

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-icon">💧</div>
        <div className="brand-text">
          AquaSuivi
          <span>Surveillance de l'eau</span>
        </div>
      </div>

      {LIENS.filter((l) => !l.adminSeulement || utilisateur?.role === 'administrateur').map((lien) => (
        <NavLink
          key={lien.to}
          to={lien.to}
          end={lien.fin}
          onClick={onNavigate}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-dot" /> {lien.label}
        </NavLink>
      ))}

      <SelecteurSite />
    </div>
  );
}
