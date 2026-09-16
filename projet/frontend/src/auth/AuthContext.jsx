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

  return (
    <AuthContext.Provider value={{ utilisateur, connexion, deconnexion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
