import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { aLeRole } from '../utils/roles';

export default function RouteProtegee({ roleRequis, children }) {
  const { utilisateur } = useAuth();

  if (!utilisateur) return <Navigate to="/connexion" replace />;
  if (roleRequis && !aLeRole(utilisateur, roleRequis)) return <Navigate to="/" replace />;

  return children;
}
