import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import GraphiqueHistorique from '../components/GraphiqueHistorique';
import { grouperParCycle } from '../utils/mesures';
import { exporterCSV, exporterExcel } from '../utils/export';
import { useSite } from '../sites/SiteContext';
import { useAuth } from '../auth/AuthContext';

const NB_LIGNES_VISIBLES = 10;
const HAUTEUR_LIGNE = 40; // px, doit correspondre au padding défini dans le style des cellules
const CLES_CAPTEURS = ['ph', 'turbidite', 'temperature', 'tds'];

export default function Historique() {
  const { siteActifId } = useSite();
  const { utilisateur } = useAuth();
  const estAdmin = utilisateur?.role === 'administrateur';
  const [mesures, setMesures] = useState([]);
  const [jours, setJours] = useState(7);
  const [lignes, setLignes] = useState([]);
  const [chargementTableau, setChargementTableau] = useState(true);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [selectionnees, setSelectionnees] = useState(new Set());
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [versionRafraichissement, setVersionRafraichissement] = useState(0);

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
  }, [mesures, jours, versionRafraichissement]);

  const capteurPH = idParType('pH');
  const capteurTurbidite = idParType('turbidite');
  const capteurTemperature = idParType('temperature');
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

  const idsDeLaLigne = (l) => CLES_CAPTEURS.map((c) => l[`${c}_id`]).filter(Boolean);

  const basculerSelection = (t) => {
    setSelectionnees((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(t)) suivant.delete(t); else suivant.add(t);
      return suivant;
    });
  };

  const toutSelectionner = (e) => {
    setSelectionnees(e.target.checked ? new Set(lignes.map((l) => l.t)) : new Set());
  };

  const supprimerLignes = async (timestamps) => {
    const ids = lignes.filter((l) => timestamps.includes(l.t)).flatMap(idsDeLaLigne);
    if (ids.length === 0) return;
    if (!window.confirm(`Supprimer définitivement ${ids.length} mesure(s) ? Cette action est irréversible.`)) return;

    setSuppressionEnCours(true);
    try {
      await client.delete('/api/mesures', { data: { ids } });
      setSelectionnees((prev) => {
        const suivant = new Set(prev);
        timestamps.forEach((t) => suivant.delete(t));
        return suivant;
      });
      setVersionRafraichissement((v) => v + 1);
    } catch (err) {
      setErreur("Impossible de supprimer ces mesures.");
    } finally {
      setSuppressionEnCours(false);
    }
  };

  return (
    <Layout titre="Historique" sousTitre="Évolution des mesures sur une période choisie">
      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>Vue d'ensemble (7 jours)</h2>
        </div>
        <GraphiqueHistorique capteurPH={capteurPH} capteurTurbidite={capteurTurbidite} capteurTemperature={capteurTemperature} capteurConductivite={capteurConductivite} />
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
            {estAdmin && selectionnees.size > 0 && (
              <button
                style={styles.btnDanger}
                onClick={() => supprimerLignes([...selectionnees])}
                disabled={suppressionEnCours}
              >
                {suppressionEnCours ? 'Suppression…' : `🗑 Supprimer la sélection (${selectionnees.size})`}
              </button>
            )}
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
                    {estAdmin && (
                      <th style={{ ...styles.enteteCellule, width: 32 }}>
                        <input type="checkbox" onChange={toutSelectionner} checked={selectionnees.size > 0 && selectionnees.size === lignes.length} />
                      </th>
                    )}
                    <th style={styles.enteteCellule}>Date / heure</th>
                    <th style={{ ...styles.enteteCellule, color: '#2563EB' }}>pH</th>
                    <th style={{ ...styles.enteteCellule, color: '#B45309' }}>Turbidité (NTU)</th>
                    <th style={{ ...styles.enteteCellule, color: '#15803D' }}>Température (°C)</th>
                    <th style={{ ...styles.enteteCellule, color: '#7C3AED' }}>Conductivité (ppm)</th>
                    {estAdmin && <th style={styles.enteteCellule}></th>}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.t}>
                      {estAdmin && (
                        <td style={styles.cellule}>
                          <input type="checkbox" checked={selectionnees.has(l.t)} onChange={() => basculerSelection(l.t)} />
                        </td>
                      )}
                      <td style={styles.cellule}>{new Date(l.t).toLocaleString('fr-FR')}</td>
                      <td style={styles.cellule}>{l.ph !== undefined ? l.ph.toFixed(2) : '—'}</td>
                      <td style={styles.cellule}>{l.turbidite !== undefined ? l.turbidite.toFixed(2) : '—'}</td>
                      <td style={styles.cellule}>{l.temperature !== undefined ? l.temperature.toFixed(1) : '—'}</td>
                      <td style={styles.cellule}>{l.tds !== undefined ? l.tds.toFixed(0) : '—'}</td>
                      {estAdmin && (
                        <td style={styles.cellule}>
                          <button style={styles.btnSupprLigne} onClick={() => supprimerLignes([l.t])} disabled={suppressionEnCours} title="Supprimer cette ligne">
                            🗑
                          </button>
                        </td>
                      )}
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
  btnDanger: { fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#B91C1C', color: 'white', cursor: 'pointer' },
  btnSupprLigne: { fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' },
  conteneurTableau: { overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 },
  tableau: { width: '100%', minWidth: 620, borderCollapse: 'collapse' },
  enteteCellule: {
    position: 'sticky', top: 0, background: '#F8FAFC', textAlign: 'left', fontSize: 11.5,
    color: '#64748B', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #E2E8F0', zIndex: 1,
  },
  cellule: { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #F1F5F9', height: 40, boxSizing: 'border-box', whiteSpace: 'nowrap' },
  compteur: { fontSize: 11.5, color: '#94A3B8', marginTop: 10, textAlign: 'right' },
};
