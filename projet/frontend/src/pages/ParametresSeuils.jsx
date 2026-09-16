import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useSite } from '../sites/SiteContext';

const TYPES_CONNUS = [
  { valeur: 'pH', unite: 'pH', numerique: false },
  { valeur: 'turbidite', unite: 'NTU', numerique: false },
  { valeur: 'temperature', unite: '°C', numerique: true },
  { valeur: 'tds', unite: 'ppm', numerique: false },
  { valeur: 'autre', unite: '', numerique: false },
];

const LABELS_TYPE = { pH: 'pH', turbidite: 'Turbidité', temperature: 'Température', tds: 'Conductivité' };
const NB_CANAUX_ADC = 8; // MCP3008 / ADS1115 : 8 canaux (0 à 7)

export default function ParametresSeuils() {
  const { siteActifId } = useSite();
  const [seuils, setSeuils] = useState([]);
  const [modifications, setModifications] = useState({});
  const [messages, setMessages] = useState({});
  const [erreur, setErreur] = useState(null);

  // ---- Formulaire d'ajout de capteur ----
  const [formOuvert, setFormOuvert] = useState(false);
  const [nouveauType, setNouveauType] = useState('pH');
  const [nouveauTypeLibre, setNouveauTypeLibre] = useState('');
  const [nouveauModele, setNouveauModele] = useState('');
  const [nouvelleUnite, setNouvelleUnite] = useState('pH');
  const [nouveauCanal, setNouveauCanal] = useState('');
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreurAjout, setErreurAjout] = useState(null);

  const charger = () => {
    if (!siteActifId) return;
    client.get(`/api/seuils?site=${siteActifId}`)
      .then((res) => setSeuils(res.data))
      .catch(() => setErreur("Impossible de charger les seuils."));
  };

  useEffect(charger, [siteActifId]);

  // Canal ADC (0-7) → type de capteur qui l'occupe déjà sur ce site (ou undefined si libre)
  const canalOccupePar = useMemo(() => {
    const carte = {};
    seuils.forEach((s) => {
      const canal = s.capteur_id?.canal_adc;
      if (canal !== null && canal !== undefined) {
        carte[canal] = s.capteur_id.type;
      }
    });
    return carte;
  }, [seuils]);

  const changerChamp = (capteurId, champ, valeur) => {
    setModifications((prev) => ({
      ...prev,
      [capteurId]: { ...prev[capteurId], [champ]: valeur },
    }));
  };

  const enregistrer = async (seuil) => {
    const modif = modifications[seuil.capteur_id._id] || {};
    const valeur_min = modif.valeur_min !== undefined ? modif.valeur_min : seuil.valeur_min;
    const valeur_max = modif.valeur_max !== undefined ? modif.valeur_max : seuil.valeur_max;

    if (valeur_min === null || valeur_min === '' || valeur_max === null || valeur_max === '') {
      setMessages((m) => ({ ...m, [seuil.capteur_id._id]: '⚠ Remplis min et max' }));
      return;
    }

    try {
      await client.put(`/api/seuils/${seuil.capteur_id._id}`, {
        valeur_min: Number(valeur_min),
        valeur_max: Number(valeur_max),
      });
      setMessages((m) => ({ ...m, [seuil.capteur_id._id]: '✔ Enregistré' }));
      charger();
      setTimeout(() => setMessages((m) => ({ ...m, [seuil.capteur_id._id]: null })), 2500);
    } catch (err) {
      setMessages((m) => ({ ...m, [seuil.capteur_id._id]: '✘ Erreur' }));
    }
  };

  const changerTypeConnu = (valeur) => {
    setNouveauType(valeur);
    const info = TYPES_CONNUS.find((t) => t.valeur === valeur);
    if (info && valeur !== 'autre') setNouvelleUnite(info.unite);
  };

  const ajouterCapteur = async (e) => {
    e.preventDefault();
    setErreurAjout(null);

    const type = nouveauType === 'autre' ? nouveauTypeLibre.trim() : nouveauType;
    if (!type || !nouveauModele.trim() || !nouvelleUnite.trim()) {
      setErreurAjout('Type, modèle et unité sont requis.');
      return;
    }

    setAjoutEnCours(true);
    try {
      await client.post('/api/capteurs', {
        site_id: siteActifId,
        type,
        modele: nouveauModele.trim(),
        unite: nouvelleUnite.trim(),
        canal_adc: nouveauCanal === '' ? null : Number(nouveauCanal),
      });
      setNouveauType('pH');
      setNouveauTypeLibre('');
      setNouveauModele('');
      setNouvelleUnite('pH');
      setNouveauCanal('');
      setFormOuvert(false);
      charger();
    } catch (err) {
      setErreurAjout(err.response?.data?.erreur || "Impossible d'ajouter ce capteur.");
    } finally {
      setAjoutEnCours(false);
    }
  };

  return (
    <Layout titre="Configuration des seuils d'alerte" sousTitre='Cas d’utilisation : « Configurer les seuils d’alerte »'>
      <div style={styles.banniereRole}>
        🔒 Page réservée au rôle Administrateur — invisible pour le Responsable CAEPA
      </div>

      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>Capteurs de ce site</h2>
          <button style={styles.boutonAjouter} onClick={() => setFormOuvert((v) => !v)}>
            {formOuvert ? 'Annuler' : '+ Ajouter un capteur'}
          </button>
        </div>

        {formOuvert && (
          <form onSubmit={ajouterCapteur} style={styles.formulaire}>
            {erreurAjout && <div className="erreur-connexion" style={{ marginBottom: 12 }}>⚠ {erreurAjout}</div>}

            <div style={styles.ligneForm}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Type de paramètre</label>
                <select style={styles.champForm} value={nouveauType} onChange={(e) => changerTypeConnu(e.target.value)}>
                  <option value="pH">pH</option>
                  <option value="turbidite">Turbidité</option>
                  <option value="temperature">Température</option>
                  <option value="tds">Conductivité (TDS)</option>
                  <option value="autre">Autre…</option>
                </select>
              </div>
              {nouveauType === 'autre' && (
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Nom du paramètre</label>
                  <input style={styles.champForm} value={nouveauTypeLibre} onChange={(e) => setNouveauTypeLibre(e.target.value)} placeholder="ex : oxygene_dissous" />
                </div>
              )}
            </div>

            <div style={styles.ligneForm}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Modèle du capteur</label>
                <input style={styles.champForm} value={nouveauModele} onChange={(e) => setNouveauModele(e.target.value)} placeholder="ex : DFRobot Pro V2" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Unité de mesure</label>
                <input style={styles.champForm} value={nouvelleUnite} onChange={(e) => setNouvelleUnite(e.target.value)} placeholder="ex : NTU" required />
              </div>
              <div style={{ width: 260 }}>
                <label style={styles.label}>Canal ADC (capteur analogique)</label>
                <select style={styles.champForm} value={nouveauCanal} onChange={(e) => setNouveauCanal(e.target.value)}>
                  <option value="">— Aucun (capteur numérique) —</option>
                  {Array.from({ length: NB_CANAUX_ADC }, (_, canal) => canal).map((canal) => {
                    const occupePar = canalOccupePar[canal];
                    return (
                      <option key={canal} value={canal} disabled={!!occupePar}>
                        Canal {canal} {occupePar ? `— déjà utilisé (${LABELS_TYPE[occupePar] || occupePar})` : '— libre'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div style={styles.legendeCanaux}>
              {Array.from({ length: NB_CANAUX_ADC }, (_, canal) => canal).map((canal) => {
                const occupePar = canalOccupePar[canal];
                return (
                  <span key={canal} style={{ ...styles.puceCanal, ...(occupePar ? styles.puceCanalOccupe : styles.puceCanalLibre) }}>
                    {canal} {occupePar ? `· ${LABELS_TYPE[occupePar] || occupePar}` : '· libre'}
                  </span>
                );
              })}
            </div>

            <button type="submit" style={styles.boutonValider} disabled={ajoutEnCours}>
              {ajoutEnCours ? 'Ajout en cours…' : 'Créer le capteur'}
            </button>
            <p style={styles.aideForm}>
              Le capteur est rattaché au site actuellement sélectionné. Choisis "Aucun" pour un capteur
              numérique (comme le DS18B20) qui se branche directement sur un GPIO, sans passer par l'ADC.
            </p>
          </form>
        )}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 0' }}>Capteur</th>
              <th style={{ padding: '10px 0' }}>Canal ADC</th>
              <th style={{ padding: '10px 0' }}>Seuil minimum</th>
              <th style={{ padding: '10px 0' }}>Seuil maximum</th>
              <th style={{ padding: '10px 0' }}></th>
            </tr>
          </thead>
          <tbody>
            {seuils.map((s) => (
              <tr key={s.capteur_id._id} style={{ borderTop: '1px solid #E2E8F0' }}>
                <td style={{ padding: '14px 0', fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap' }}>
                  {s.capteur_id?.type}
                  {s.valeur_min === null && <span style={styles.puceNouveau}>nouveau — seuil à définir</span>}
                </td>
                <td style={{ padding: '14px 0', fontSize: 12.5, color: '#64748B' }}>
                  {s.capteur_id?.canal_adc !== null && s.capteur_id?.canal_adc !== undefined
                    ? `Canal ${s.capteur_id.canal_adc}`
                    : 'Numérique (GPIO)'}
                </td>
                <td style={{ padding: '14px 0' }}>
                  <input
                    style={styles.champ}
                    type="number" step="any"
                    defaultValue={s.valeur_min ?? ''}
                    placeholder="min"
                    onChange={(e) => changerChamp(s.capteur_id._id, 'valeur_min', e.target.value)}
                  />
                </td>
                <td style={{ padding: '14px 0' }}>
                  <input
                    style={styles.champ}
                    type="number" step="any"
                    defaultValue={s.valeur_max ?? ''}
                    placeholder="max"
                    onChange={(e) => changerChamp(s.capteur_id._id, 'valeur_max', e.target.value)}
                  />
                </td>
                <td style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                  <button style={styles.bouton} onClick={() => enregistrer(s)}>Enregistrer</button>
                  {messages[s.capteur_id._id] && <span style={{ fontSize: 12 }}>{messages[s.capteur_id._id]}</span>}
                </td>
              </tr>
            ))}
            {seuils.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '14px 0', color: '#64748B' }}>Aucun capteur pour ce site pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

const styles = {
  banniereRole: { display: 'flex', alignItems: 'center', gap: 10, background: '#EDE9FE', color: '#5B21B6', borderRadius: 10, padding: '10px 16px', margin: '0 0 20px 0', fontSize: 12.5, fontWeight: 600 },
  boutonAjouter: { padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  formulaire: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 18, marginTop: 4 },
  ligneForm: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  champForm: { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 },
  legendeCanaux: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  puceCanal: { fontSize: 10.5, fontWeight: 600, padding: '4px 9px', borderRadius: 999 },
  puceCanalLibre: { background: '#DCFCE7', color: '#15803D' },
  puceCanalOccupe: { background: '#FEE2E2', color: '#B91C1C' },
  boutonValider: { padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  aideForm: { fontSize: 11.5, color: '#94A3B8', marginTop: 10, lineHeight: 1.5 },
  champ: { width: 90, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 600 },
  bouton: { padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  puceNouveau: { display: 'inline-block', marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 },
};
