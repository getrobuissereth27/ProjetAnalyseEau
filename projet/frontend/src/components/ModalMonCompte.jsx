import { useState } from 'react';
import client from '../api/client';

export default function ModalMonCompte({ utilisateur, onFermer, onDeconnexion }) {
  const [ancienMotDePasse, setAncienMotDePasse] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    setSucces(false);

    if (nouveauMotDePasse.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await client.put('/api/utilisateurs/moi/mot-de-passe', { ancienMotDePasse, nouveauMotDePasse });
      setSucces(true);
      setAncienMotDePasse('');
      setNouveauMotDePasse('');
      setConfirmation('');
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible de modifier le mot de passe.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={styles.fond} onClick={onFermer}>
      <div style={styles.panneau} onClick={(e) => e.stopPropagation()}>
        <div style={styles.entete}>
          <div>
            <h3 style={styles.titre}>Mon compte</h3>
            <p style={styles.sousTitre}>{utilisateur?.nom} — {utilisateur?.email}</p>
          </div>
          <button style={styles.boutonFermer} onClick={onFermer}>✕</button>
        </div>

        <form onSubmit={soumettre}>
          <p style={styles.labelSection}>Modifier mon mot de passe</p>

          {erreur && <div className="erreur-connexion" style={{ marginBottom: 12 }}>⚠ {erreur}</div>}
          {succes && (
            <div style={styles.succes}>✔ Mot de passe modifié avec succès.</div>
          )}

          <label style={styles.label}>Mot de passe actuel</label>
          <input
            style={styles.champ} type="password" value={ancienMotDePasse}
            onChange={(e) => setAncienMotDePasse(e.target.value)} required
          />

          <label style={styles.label}>Nouveau mot de passe</label>
          <input
            style={styles.champ} type="password" value={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)} placeholder="8 caractères minimum" required
          />

          <label style={styles.label}>Confirmer le nouveau mot de passe</label>
          <input
            style={styles.champ} type="password" value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} required
          />

          <button type="submit" style={styles.boutonValider} disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Modifier le mot de passe'}
          </button>
        </form>

        <div style={styles.separateur} />

        <button style={styles.boutonDeconnexion} onClick={onDeconnexion}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

const styles = {
  fond: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  panneau: { background: 'white', borderRadius: 14, padding: 26, width: 400, maxWidth: '100%' },
  entete: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  titre: { fontSize: 16, color: '#0F172A' },
  sousTitre: { fontSize: 12, color: '#64748B', marginTop: 2 },
  boutonFermer: { background: 'none', border: 'none', fontSize: 16, color: '#94A3B8', cursor: 'pointer', padding: 4 },
  labelSection: { fontSize: 11.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5, marginTop: 12 },
  champ: { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5 },
  boutonValider: { width: '100%', marginTop: 20, padding: '9px 0', borderRadius: 8, fontSize: 13.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  succes: { background: '#DCFCE7', color: '#15803D', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 12 },
  separateur: { height: 1, background: '#E2E8F0', margin: '22px 0 16px 0' },
  boutonDeconnexion: { width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' },
};
