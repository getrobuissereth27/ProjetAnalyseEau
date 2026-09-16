import { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [sites, setSites] = useState([]);
  const [siteActifId, setSiteActifId] = useState(() => localStorage.getItem('siteActifId') || '');
  const [chargement, setChargement] = useState(true);

  const chargerSites = async () => {
    try {
      const res = await client.get('/api/sites');
      setSites(res.data);
      // Si aucun site n'est encore sélectionné (ou qu'il n'existe plus), on prend le premier
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

  useEffect(() => { chargerSites(); }, []);

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
    <SiteContext.Provider value={{ sites, siteActifId, setSiteActifId, ajouterSite, chargement }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
