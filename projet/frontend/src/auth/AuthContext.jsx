import { createContext, useContext, useEffect, useState } from 'react';
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

  // Le rôle et les sites mémorisés à la connexion peuvent devenir faux (ex : un
  // super administrateur change le rôle de ce compte). On relit le profil actuel
  // au chargement de l'application et à chaque retour sur l'onglet, pour que
  // l'interface n'affiche que les actions réellement autorisées.
  const idUtilisateur = utilisateur?.id;
  useEffect(() => {
    if (!idUtilisateur) return undefined;

    const rafraichirProfil = () => {
      client.get('/api/auth/me')
        .then((res) => mettreAJourUtilisateur(res.data))
        .catch((err) => {
          // Jeton expiré ou compte supprimé : retour à l'écran de connexion
          if (err.response?.status === 401) deconnexion();
        });
    };

    rafraichirProfil();
    window.addEventListener('focus', rafraichirProfil);
    return () => window.removeEventListener('focus', rafraichirProfil);
  }, [idUtilisateur]);

  return (
    <AuthContext.Provider value={{ utilisateur, connexion, deconnexion, mettreAJourUtilisateur }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
