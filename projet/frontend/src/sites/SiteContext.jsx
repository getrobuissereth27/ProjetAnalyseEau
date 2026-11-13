import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';

const SiteContext = createContext(null);

// La liste des sites dépend de l'utilisateur connecté (le backend ne renvoie que
// les sites qui lui sont attribués, ou tous pour le superadmin) : elle est
// rechargée à chaque connexion / changement de compte.
export function SiteProvider({ children }) {
  const { utilisateur } = useAuth();
  const [sites, setSites] = useState([]);
  const [siteActifId, setSiteActifId] = useState(() => localStorage.getItem('siteActifId') || '');
  const [chargement, setChargement] = useState(true);

  const chargerSites = async () => {
    if (!utilisateur) {
      setSites([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    try {
      const res = await client.get('/api/sites');
      setSites(res.data);
      // Si aucun site n'est encore sélectionné (ou qu'il n'est plus accessible), on prend le premier
      setSiteActifId((actuel) => {
        const existeEncore = res.data.some((s) => s._id === actuel);
        return existeEncore ? actuel : (res.data[0]?._id || '');
      });
    } catch (err) {
      // silencieux : les pages qui utilisent les données afficheront leur propre erreur
    } finally {
      setChargement(false);
    }
  };

  // Rechargée à la connexion, et dès que le rôle ou les sites du compte changent
  // (voir le rafraîchissement du profil dans AuthContext).
  const cleSites = `${utilisateur?.id}|${utilisateur?.role}|${(utilisateur?.sites || []).join(',')}`;
  useEffect(() => { chargerSites(); }, [cleSites]);

  useEffect(() => {
    if (siteActifId) localStorage.setItem('siteActifId', siteActifId);
  }, [siteActifId]);

  const ajouterSite = async (nom, localisation) => {
    const res = await client.post('/api/sites', { nom, localisation });
    await chargerSites();
    setSiteActifId(res.data._id);
    return res.data;
  };

  return (
    <SiteContext.Provider value={{ sites, siteActifId, setSiteActifId, ajouterSite, chargerSites, chargement }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
