import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import GestionDestinataires from '../components/GestionDestinataires';
import PortsArduino from '../components/PortsArduino';
import { useSite } from '../sites/SiteContext';

const TYPES_CONNUS = [
  { valeur: 'pH', unite: 'pH', numerique: false },
  { valeur: 'turbidite', unite: 'NTU', numerique: false },
  { valeur: 'temperature', unite: '°C', numerique: true },
  { valeur: 'tds', unite: 'ppm', numerique: false },
  { valeur: 'autre', unite: '', numerique: false },
];

const LABELS_TYPE = { pH: 'pH', turbidite: 'Turbidité', temperature: 'Température', tds: 'Conductivité' };
const STATUT_INFO = {
  fonctionne: { libelle: 'Fonctionne', couleur: '#15803D', fond: '#DCFCE7' },
  defectueux: { libelle: 'Défectueux', couleur: '#B91C1C', fond: '#FEE2E2' },
  desactive: { libelle: 'Désactivé', couleur: '#64748B', fond: '#F1F5F9' },
  inconnu: { libelle: 'Inconnu', couleur: '#B45309', fond: '#FEF3C7' },
};

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
  const [nouvelleBroche, setNouvelleBroche] = useState('');
  const [nouvelleBrocheLibre, setNouvelleBrocheLibre] = useState('');
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreurAjout, setErreurAjout] = useState(null);

  // ---- Édition d'un capteur existant (remplacement de modèle / broche) ----
  const [editionId, setEditionId] = useState(null);
  const [editionModele, setEditionModele] = useState('');
  const [editionBroche, setEditionBroche] = useState('');
  const [editionEnCours, setEditionEnCours] = useState(false);
  const [erreurEdition, setErreurEdition] = useState(null);

  const BROCHES_ANALOGIQUES = Array.from({ length: 16 }, (_, i) => `A${i}`);

  const charger = () => {
    if (!siteActifId) return;
    client.get(`/api/seuils?site=${siteActifId}`)
      .then((res) => setSeuils(res.data))
      .catch(() => setErreur("Impossible de charger les seuils."));
  };

  useEffect(charger, [siteActifId]);

  const brocheOccupeePar = {};
  seuils.forEach((s) => {
    const broche = s.capteur_id?.broche;
    if (broche) brocheOccupeePar[broche] = s.capteur_id.type;
  });

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

  const commencerEditionCapteur = (capteur) => {
    setEditionId(capteur._id);
    setEditionModele(capteur.modele);
    setEditionBroche(capteur.broche || '');
    setErreurEdition(null);
  };

  const annulerEditionCapteur = () => {
    setEditionId(null);
    setErreurEdition(null);
  };

  const enregistrerRemplacement = async (capteurId) => {
    setErreurEdition(null);
    if (!editionModele.trim()) {
      setErreurEdition('Le modèle ne peut pas être vide.');
      return;
    }
    setEditionEnCours(true);
    try {
      await client.patch(`/api/capteurs/${capteurId}`, {
        modele: editionModele.trim(),
        broche: editionBroche,
      });
      setEditionId(null);
      charger();
    } catch (err) {
      setErreurEdition(err.response?.data?.erreur || 'Impossible de modifier ce capteur.');
    } finally {
      setEditionEnCours(false);
    }
  };

  const changerActivation = async (capteurId, actif) => {
    try {
      await client.patch(`/api/capteurs/${capteurId}/actif`, { actif });
      charger();
    } catch (err) {
      setMessages((m) => ({ ...m, [capteurId]: '✘ Erreur' }));
    }
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
        broche: nouvelleBroche === 'autre' ? nouvelleBrocheLibre.trim() : nouvelleBroche,
      });
      setNouveauType('pH');
      setNouveauTypeLibre('');
      setNouveauModele('');
      setNouvelleUnite('pH');
      setNouvelleBroche('');
      setNouvelleBrocheLibre('');
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
        Page réservée au rôle Administrateur — invisible pour le Responsable CAEPA
      </div>

      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <GestionDestinataires />

      <PortsArduino seuils={seuils} />

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
              <div style={{ width: 240 }}>
                <label style={styles.label}>Broche Arduino</label>
                <select style={styles.champForm} value={nouvelleBroche} onChange={(e) => setNouvelleBroche(e.target.value)}>
                  <option value="">— Non précisée —</option>
                  {BROCHES_ANALOGIQUES.map((broche) => {
                    const occupePar = brocheOccupeePar[broche];
                    return (
                      <option key={broche} value={broche} disabled={!!occupePar}>
                        {broche} {occupePar ? `— déjà utilisée (${LABELS_TYPE[occupePar] || occupePar})` : '— libre'}
                      </option>
                    );
                  })}
                  <option value="autre">Autre (broche numérique, ex: D2)…</option>
                </select>
              </div>
            </div>

            {nouvelleBroche === 'autre' && (
              <div style={{ ...styles.ligneForm, marginTop: -4 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Nom de la broche numérique</label>
                  <input style={styles.champForm} value={nouvelleBrocheLibre} onChange={(e) => setNouvelleBrocheLibre(e.target.value)} placeholder="ex : D2" />
                </div>
              </div>
            )}

            <button type="submit" style={styles.boutonValider} disabled={ajoutEnCours}>
              {ajoutEnCours ? 'Ajout en cours…' : 'Créer le capteur'}
            </button>
            <p style={styles.aideForm}>
              Le capteur est rattaché au site actuellement sélectionné.
            </p>
          </form>
        )}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 0' }}>Capteur</th>
              <th style={{ padding: '10px 0' }}>Broche</th>
              <th style={{ padding: '10px 0' }}>État</th>
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
                  {editionId === s.capteur_id._id ? (
                    <input
                      style={{ ...styles.champEdition, display: 'block', marginTop: 6, fontWeight: 400 }}
                      value={editionModele}
                      onChange={(e) => setEditionModele(e.target.value)}
                      placeholder="Modèle"
                    />
                  ) : (
                    <p style={{ fontWeight: 400, fontSize: 11.5, color: '#94A3B8', margin: '2px 0 0' }}>{s.capteur_id?.modele}</p>
                  )}
                  {erreurEdition && editionId === s.capteur_id._id && (
                    <p style={{ fontSize: 10.5, color: '#B91C1C', fontWeight: 400, margin: '4px 0 0' }}>⚠ {erreurEdition}</p>
                  )}
                </td>
                <td style={{ padding: '14px 0', fontSize: 13, color: '#475569' }}>
                  {editionId === s.capteur_id._id ? (
                    <select style={styles.champEdition} value={editionBroche} onChange={(e) => setEditionBroche(e.target.value)}>
                      <option value="">— Non précisée —</option>
                      {BROCHES_ANALOGIQUES.map((broche) => {
                        const occupePar = brocheOccupeePar[broche];
                        const occupeeParAutre = occupePar && broche !== s.capteur_id.broche;
                        return (
                          <option key={broche} value={broche} disabled={!!occupeeParAutre}>
                            {broche} {occupeeParAutre ? `— déjà utilisée (${LABELS_TYPE[occupePar] || occupePar})` : ''}
                          </option>
                        );
                      })}
                      {s.capteur_id.broche && !BROCHES_ANALOGIQUES.includes(s.capteur_id.broche) && (
                        <option value={s.capteur_id.broche}>{s.capteur_id.broche} (numérique)</option>
                      )}
                    </select>
                  ) : (
                    s.capteur_id?.broche || <span style={{ color: '#CBD5E1' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '14px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      ...styles.puceStatut,
                      color: STATUT_INFO[s.capteur_id?.statut]?.couleur,
                      background: STATUT_INFO[s.capteur_id?.statut]?.fond,
                    }}>
                      {STATUT_INFO[s.capteur_id?.statut]?.libelle || 'Inconnu'}
                    </span>
                    <button
                      style={styles.boutonBascule}
                      onClick={() => changerActivation(s.capteur_id._id, s.capteur_id.statut === 'desactive')}
                    >
                      {s.capteur_id?.statut === 'desactive' ? 'Activer' : 'Désactiver'}
                    </button>
                  </div>
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
                  {editionId === s.capteur_id._id ? (
                    <>
                      <button style={styles.bouton} onClick={() => enregistrerRemplacement(s.capteur_id._id)} disabled={editionEnCours}>
                        {editionEnCours ? '…' : '✔ Confirmer'}
                      </button>
                      <button style={styles.boutonBascule} onClick={annulerEditionCapteur}>Annuler</button>
                    </>
                  ) : (
                    <>
                      <button style={styles.bouton} onClick={() => enregistrer(s)}>Enregistrer</button>
                      <button style={styles.boutonBascule} onClick={() => commencerEditionCapteur(s.capteur_id)}>Remplacer</button>
                      {messages[s.capteur_id._id] && <span style={{ fontSize: 12 }}>{messages[s.capteur_id._id]}</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {seuils.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '14px 0', color: '#64748B' }}>Aucun capteur pour ce site pour l'instant.</td></tr>
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
  boutonValider: { padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  aideForm: { fontSize: 11.5, color: '#94A3B8', marginTop: 10, lineHeight: 1.5 },
  champ: { width: 90, padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 600 },
  bouton: { padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  puceNouveau: { display: 'inline-block', marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: 999 },
  champEdition: { fontSize: 12.5, padding: '5px 8px', border: '1px solid #0F766E', borderRadius: 6, width: '100%', maxWidth: 180, boxSizing: 'border-box' },
  puceStatut: { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' },
  boutonBascule: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' },
};
