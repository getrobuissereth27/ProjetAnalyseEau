import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import GraphiqueHistorique from '../components/GraphiqueHistorique';
import { grouperParCycle } from '../utils/mesures';
import { exporterCSV, exporterExcel } from '../utils/export';
import { useSite } from '../sites/SiteContext';

const NB_LIGNES_VISIBLES = 10;
const HAUTEUR_LIGNE = 40; // px, doit correspondre au padding défini dans le style des cellules

export default function Historique() {
  const { siteActifId } = useSite();
  const [mesures, setMesures] = useState([]);
  const [jours, setJours] = useState(7);
  const [lignes, setLignes] = useState([]);
  const [chargementTableau, setChargementTableau] = useState(true);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (!siteActifId) return;
    client.get(`/api/mesures/dernieres?site=${siteActifId}`)
      .then((res) => setMesures(res.data))
      .catch(() => setErreur("Impossible de contacter l'API."));
  }, [siteActifId]);

  const idParType = (type) => mesures.find((m) => m.type === type)?.capteur_id;

  useEffect(() => {
    if (mesures.length === 0) return;
    setChargementTableau(true);

    const capteurs = { ph: idParType('pH'), turbidite: idParType('turbidite'), temperature: idParType('temperature'), tds: idParType('tds') };
    const cles = Object.entries(capteurs).filter(([, id]) => id);

    Promise.all(cles.map(([, id]) => client.get(`/api/mesures/historique?capteur=${id}&jours=${jours}`)))
      .then((reponses) => {
        const donneesParCle = {};
        cles.forEach(([cle], i) => { donneesParCle[cle] = reponses[i].data; });
        setLignes(grouperParCycle(donneesParCle));
      })
      .catch(() => setErreur("Impossible de charger l'historique."))
      .finally(() => setChargementTableau(false));
  }, [mesures, jours]);

  const capteurPH = idParType('pH');
  const capteurTurbidite = idParType('turbidite');
  const capteurConductivite = idParType('tds');

  const telechargerToutLHistorique = async () => {
    setTelechargementEnCours(true);
    try {
      const capteurs = { ph: idParType('pH'), turbidite: idParType('turbidite'), temperature: idParType('temperature'), tds: idParType('tds') };
      const cles = Object.entries(capteurs).filter(([, id]) => id);
      const reponses = await Promise.all(cles.map(([, id]) => client.get(`/api/mesures/historique?capteur=${id}&jours=90`)));
      const donneesParCle = {};
      cles.forEach(([cle], i) => { donneesParCle[cle] = reponses[i].data; });
      const toutesLesLignes = grouperParCycle(donneesParCle);
      exporterExcel(toutesLesLignes, `historique_complet_90j.xlsx`);
    } catch (err) {
      setErreur("Impossible de télécharger l'historique complet.");
    } finally {
      setTelechargementEnCours(false);
    }
  };

  return (
    <Layout titre="Historique" sousTitre="Évolution des mesures sur une période choisie">
      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>Vue d'ensemble (7 jours)</h2>
        </div>
        <GraphiqueHistorique capteurPH={capteurPH} capteurTurbidite={capteurTurbidite} capteurConductivite={capteurConductivite} />
      </div>

      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Tableau des mesures</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={jours} onChange={(e) => setJours(Number(e.target.value))} style={styles.select}>
              <option value={1}>24h</option>
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
            </select>
            <button style={styles.btnSecondaire} onClick={() => exporterCSV(lignes, `historique_${jours}j.csv`)} disabled={lignes.length === 0}>
              ⬇ Export CSV
            </button>
            <button style={styles.btnSecondaire} onClick={() => exporterExcel(lignes, `historique_${jours}j.xlsx`)} disabled={lignes.length === 0}>
              ⬇ Export Excel
            </button>
            <button style={styles.btnPrincipal} onClick={telechargerToutLHistorique} disabled={telechargementEnCours}>
              {telechargementEnCours ? 'Préparation…' : '⬇ Télécharger tout l\'historique (90j)'}
            </button>
          </div>
        </div>

        {chargementTableau && <p className="chargement">Chargement du tableau…</p>}

        {!chargementTableau && lignes.length === 0 && (
          <p className="chargement">Aucune mesure sur cette période.</p>
        )}

        {!chargementTableau && lignes.length > 0 && (
          <>
            <div style={{ ...styles.conteneurTableau, maxHeight: NB_LIGNES_VISIBLES * HAUTEUR_LIGNE + HAUTEUR_LIGNE }}>
              <table style={styles.tableau}>
                <thead>
                  <tr>
                    <th style={styles.enteteCellule}>Date / heure</th>
                    <th style={{ ...styles.enteteCellule, color: '#2563EB' }}>pH</th>
                    <th style={{ ...styles.enteteCellule, color: '#B45309' }}>Turbidité (NTU)</th>
                    <th style={{ ...styles.enteteCellule, color: '#15803D' }}>Température (°C)</th>
                    <th style={{ ...styles.enteteCellule, color: '#7C3AED' }}>Conductivité (ppm)</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.t}>
                      <td style={styles.cellule}>{new Date(l.t).toLocaleString('fr-FR')}</td>
                      <td style={styles.cellule}>{l.ph !== undefined ? l.ph.toFixed(2) : '—'}</td>
                      <td style={styles.cellule}>{l.turbidite !== undefined ? l.turbidite.toFixed(2) : '—'}</td>
                      <td style={styles.cellule}>{l.temperature !== undefined ? l.temperature.toFixed(1) : '—'}</td>
                      <td style={styles.cellule}>{l.tds !== undefined ? l.tds.toFixed(0) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={styles.compteur}>
              {lignes.length} ligne(s) au total — {NB_LIGNES_VISIBLES} affichées à la fois, fais défiler pour voir les autres.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  select: { fontSize: 12.5, padding: '5px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155' },
  btnSecondaire: { fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer' },
  btnPrincipal: { fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  conteneurTableau: { overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 },
  tableau: { width: '100%', minWidth: 620, borderCollapse: 'collapse' },
  enteteCellule: {
    position: 'sticky', top: 0, background: '#F8FAFC', textAlign: 'left', fontSize: 11.5,
    color: '#64748B', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #E2E8F0', zIndex: 1,
  },
  cellule: { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', height: 40, boxSizing: 'border-box', whiteSpace: 'nowrap' },
  compteur: { fontSize: 11.5, color: '#94A3B8', marginTop: 10, textAlign: 'right' },
};
