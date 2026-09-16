import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SiteProvider } from './sites/SiteContext';
import RouteProtegee from './components/RouteProtegee';

import Connexion from './pages/Connexion';
import TableauDeBord from './pages/TableauDeBord';
import Historique from './pages/Historique';
import Alertes from './pages/Alertes';
import ParametresSeuils from './pages/ParametresSeuils';
import Utilisateurs from './pages/Utilisateurs';
import NotificationsEmail from './pages/NotificationsEmail';

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/" element={<RouteProtegee><TableauDeBord /></RouteProtegee>} />
            <Route path="/historique" element={<RouteProtegee><Historique /></RouteProtegee>} />
            <Route path="/alertes" element={<RouteProtegee><Alertes /></RouteProtegee>} />
            <Route
              path="/parametres"
              element={<RouteProtegee roleRequis="administrateur"><ParametresSeuils /></RouteProtegee>}
            />
            <Route
              path="/utilisateurs"
              element={<RouteProtegee roleRequis="administrateur"><Utilisateurs /></RouteProtegee>}
            />
            <Route
              path="/notifications"
              element={<RouteProtegee roleRequis="administrateur"><NotificationsEmail /></RouteProtegee>}
            />
          </Routes>
        </BrowserRouter>
      </SiteProvider>
    </AuthProvider>
  );
}
