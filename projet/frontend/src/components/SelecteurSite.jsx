import { useState } from 'react';
import { useSite } from '../sites/SiteContext';
import { useAuth } from '../auth/AuthContext';

export default function SelecteurSite() {
  const { sites, siteActifId, setSiteActifId, ajouterSite, chargement } = useSite();
  const { utilisateur } = useAuth();
  const [modalOuvert, setModalOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [localisation, setLocalisation] = useState('');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      await ajouterSite(nom.trim(), localisation.trim());
      setNom('');
      setLocalisation('');
      setModalOuvert(false);
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible d'ajouter ce site.");
    } finally {
      setEnCours(false);
    }
  };

  if (chargement) {
    return <div style={styles.zone}><p style={styles.label}>Point de captage</p><p style={styles.chargementTexte}>Chargement…</p></div>;
  }

  return (
    <div style={styles.zone}>
      <p style={styles.label}>Point de captage</p>

      {sites.length > 0 ? (
        <select
          value={siteActifId}
          onChange={(e) => setSiteActifId(e.target.value)}
          style={styles.select}
        >
          {sites.map((s) => (
            <option key={s._id} value={s._id}>{s.nom}</option>
          ))}
        </select>
      ) : (
        <p style={styles.aucunSite}>Aucun site pour l'instant</p>
      )}

      {utilisateur?.role === 'administrateur' && (
        <button style={styles.boutonAjouter} onClick={() => setModalOuvert(true)}>
          + Ajouter un site
        </button>
      )}

      {modalOuvert && (
        <div style={styles.fondModal} onClick={() => setModalOuvert(false)}>
          <form style={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={soumettre}>
            <h3 style={styles.titreModal}>Ajouter un nouveau site</h3>
            <p style={styles.sousTitreModal}>
              Un nouveau point de captage à surveiller — tu pourras ensuite y rattacher des capteurs.
            </p>

            {erreur && <div className="erreur-connexion" style={{ marginBottom: 12 }}>⚠ {erreur}</div>}

            <label style={styles.champLabel}>Nom du site *</label>
            <input
              style={styles.champInput}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex : Source communautaire — Site 2"
              required
              autoFocus
            />

            <label style={styles.champLabel}>Localisation (optionnel)</label>
            <input
              style={styles.champInput}
              value={localisation}
              onChange={(e) => setLocalisation(e.target.value)}
              placeholder="ex : Quartier Nord"
            />

            <div style={styles.actionsModal}>
              <button type="button" style={styles.boutonAnnuler} onClick={() => setModalOuvert(false)}>
                Annuler
              </button>
              <button type="submit" style={styles.boutonValider} disabled={enCours}>
                {enCours ? 'Création…' : 'Créer le site'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  zone: { marginTop: 24, padding: '18px 24px 0 24px', borderTop: '1px solid #1E293B' },
  label: { fontSize: 10.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 600 },
  chargementTexte: { fontSize: 12, color: '#64748B' },
  aucunSite: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  select: {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #334155',
    background: '#1E293B', color: 'white', fontSize: 12.5, fontWeight: 600, marginBottom: 8,
  },
  boutonAjouter: {
    width: '100%', padding: '7px 0', borderRadius: 8, border: '1px dashed #334155',
    background: 'transparent', color: '#94A3B8', fontSize: 11.5, cursor: 'pointer',
  },

  fondModal: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
  },
  modal: { background: 'white', borderRadius: 14, padding: 26, width: 380, maxWidth: '100%' },
  titreModal: { fontSize: 16, color: '#0F172A', marginBottom: 6 },
  sousTitreModal: { fontSize: 12.5, color: '#64748B', marginBottom: 18, lineHeight: 1.5 },
  champLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, marginTop: 12 },
  champInput: { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5 },
  actionsModal: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  boutonAnnuler: { padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155', fontSize: 13, cursor: 'pointer' },
  boutonValider: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0F766E', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};
