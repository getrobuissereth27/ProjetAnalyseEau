import { createContext, useContext, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(() => {
    const stocke = localStorage.getItem('utilisateur');
    return stocke ? JSON.parse(stocke) : null;
  });

  const connexion = async (email, motDePasse) => {
    const res = await client.post('/api/auth/login', { email, motDePasse });
    localStorage.setItem('jeton', res.data.jeton);
    localStorage.setItem('utilisateur', JSON.stringify(res.data.utilisateur));
    setUtilisateur(res.data.utilisateur);
  };

  const deconnexion = () => {
    localStorage.removeItem('jeton');
    localStorage.removeItem('utilisateur');
    setUtilisateur(null);
  };

  // Met à jour l'utilisateur affiché (ex: après modification du nom) sans
  // nécessiter une reconnexion — fusionne les champs fournis dans l'état actuel.
  const mettreAJourUtilisateur = (partiel) => {
    setUtilisateur((prev) => {
      const suivant = { ...prev, ...partiel };
      localStorage.setItem('utilisateur', JSON.stringify(suivant));
      return suivant;
    });
  };

  return (
    <AuthContext.Provider value={{ utilisateur, connexion, deconnexion, mettreAJourUtilisateur }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
