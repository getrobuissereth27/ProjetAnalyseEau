import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Layout from '../components/Layout';
import CarteCapteur from '../components/CarteCapteur';
import GraphiqueHistorique from '../components/GraphiqueHistorique';
import BandeauVanne from '../components/BandeauVanne';
import { useSite } from '../sites/SiteContext';

export default function TableauDeBord() {
  const { siteActifId, chargement: chargementSites } = useSite();
  const [mesures, setMesures] = useState([]);
  const [alertes, setAlertes] = useState({ resultats: [], total: 0 });
  const [vanne, setVanne] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [derniereMaj, setDerniereMaj] = useState(null);

  useEffect(() => {
    if (chargementSites) return;
    if (!siteActifId) { setChargement(false); return; }

    const charger = async () => {
      try {
        const [resMesures, resAlertes, resVanne] = await Promise.all([
          client.get(`/api/mesures/dernieres?site=${siteActifId}`),
          client.get(`/api/alertes?page=1&limite=8&site=${siteActifId}`),
          client.get(`/api/vanne/etat?site=${siteActifId}`),
        ]);
        setMesures(resMesures.data);
        setAlertes(resAlertes.data);
        setVanne(resVanne.data);
        setErreur(null);
        setDerniereMaj(new Date());
      } catch (err) {
        setErreur(
          "Impossible de contacter l'API. Vérifie qu'elle tourne bien (voir README) et que VITE_API_URL est correct."
        );
      } finally {
        setChargement(false);
      }
    };

    charger();
    const intervalle = setInterval(charger, 10000);
    return () => clearInterval(intervalle);
  }, [siteActifId, chargementSites]);

  const alertesActivesParCapteur = (capteurId) =>
    alertes.resultats.some((a) => a.statut === 'active' && a.mesure_id?.capteur_id?._id === capteurId);

  const capteurPH = mesures.find((m) => m.type === 'pH')?.capteur_id;
  const capteurTurbidite = mesures.find((m) => m.type === 'turbidite')?.capteur_id;
  const capteurConductivite = mesures.find((m) => m.type === 'tds')?.capteur_id;

  return (
    <Layout
      titre="Tableau de bord"
      sousTitre={derniereMaj ? `Dernière mise à jour : ${derniereMaj.toLocaleTimeString('fr-FR')}` : 'Chargement…'}
    >
      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}
      {chargement && !erreur && <p className="chargement">Chargement des données…</p>}
      {!chargement && !erreur && !siteActifId && (
        <p className="chargement">
          Aucun site n'existe encore — un administrateur peut en créer un depuis la barre latérale
          ("+ Ajouter un site").
        </p>
      )}

      {!chargement && !erreur && siteActifId && (
        <>
          <BandeauVanne etat={vanne} />

          <div className="cartes">
            {mesures.map((m) => (
              <CarteCapteur
                key={m.capteur_id}
                type={m.type}
                valeur={m.valeur}
                unite={m.unite}
                enAlerte={alertesActivesParCapteur(m.capteur_id)}
              />
            ))}
            {mesures.length === 0 && (
              <p className="chargement">
                Aucune mesure pour l'instant — lance le client Raspberry Pi (ou le mode simulation)
                pour en générer.
              </p>
            )}
          </div>

          <div className="content-grid">
            <div className="panel">
              <div className="panel-header">
                <h2>Évolution sur 7 jours</h2>
                <span className="tag">pH · Turbidité · Conductivité</span>
              </div>
              <GraphiqueHistorique
                capteurPH={capteurPH}
                capteurTurbidite={capteurTurbidite}
                capteurConductivite={capteurConductivite}
              />
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Alertes récentes</h2>
                <span className="tag">{alertes.total} au total</span>
              </div>
              {alertes.resultats.length === 0 && <p className="chargement">Aucune alerte enregistrée.</p>}
              {alertes.resultats.map((a) => (
                <div className="alert-row" key={a._id}>
                  <div className={`alert-icon ${a.statut === 'active' ? 'amber' : 'gray'}`}>
                    {a.statut === 'active' ? '!' : '✓'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="alert-title">{a.type_alerte}</div>
                    <div className="alert-meta">
                      {a.mesure_id?.capteur_id?.type ?? '?'} · {new Date(a.horodatage).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <span className={`alert-status ${a.statut === 'active' ? 'active' : 'resolved'}`}>
                    {a.statut === 'active' ? 'Active' : 'Résolue'}
                  </span>
                </div>
              ))}
              {alertes.total > 8 && (
                <Link to="/alertes" style={{ display: 'block', textAlign: 'center', marginTop: 14, fontSize: 12.5, fontWeight: 700, color: '#0F766E' }}>
                  Voir toutes les alertes ({alertes.total}) →
                </Link>
              )}
            </div>
          </div>

          <p className="footer-note">
            Travail de Fin d'Études — Surveillance de la qualité de l'eau potable
          </p>
        </>
      )}
    </Layout>
  );
}
