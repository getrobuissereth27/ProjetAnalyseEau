import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RouteProtegee({ roleRequis, children }) {
  const { utilisateur } = useAuth();

  if (!utilisateur) return <Navigate to="/connexion" replace />;
  if (roleRequis && utilisateur.role !== roleRequis) return <Navigate to="/" replace />;

  return children;
}
