import { useState } from 'react';
import client from '../api/client';

export default function ChangerMotDePasse({ onFermer }) {
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const valider = async (e) => {
    e.preventDefault();
    setErreur(null);

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
      await client.patch('/api/utilisateurs/moi/mot-de-passe', { motDePasseActuel, nouveauMotDePasse });
      setSucces(true);
      setTimeout(onFermer, 1500);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Impossible de changer le mot de passe.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={styles.fond} onClick={onFermer}>
      <div style={styles.panneau} onClick={(e) => e.stopPropagation()}>
        <div style={styles.entete}>
          <h3 style={styles.titre}>Changer mon mot de passe</h3>
          <button style={styles.boutonFermer} onClick={onFermer}>✕</button>
        </div>

        {succes ? (
          <p style={styles.succes}>✔ Mot de passe modifié avec succès.</p>
        ) : (
          <form onSubmit={valider} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

            <div>
              <label style={styles.label}>Mot de passe actuel</label>
              <input
                type="password" style={styles.champ} value={motDePasseActuel}
                onChange={(e) => setMotDePasseActuel(e.target.value)} required
              />
            </div>
            <div>
              <label style={styles.label}>Nouveau mot de passe</label>
              <input
                type="password" style={styles.champ} value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)} required minLength={8}
              />
            </div>
            <div>
              <label style={styles.label}>Confirmer le nouveau mot de passe</label>
              <input
                type="password" style={styles.champ} value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)} required minLength={8}
              />
            </div>

            <button type="submit" style={styles.bouton} disabled={enCours}>
              {enCours ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  fond: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  panneau: { background: 'white', borderRadius: 14, padding: 26, width: 380, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' },
  entete: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titre: { fontSize: 16, color: '#0F172A' },
  boutonFermer: { background: 'none', border: 'none', fontSize: 16, color: '#94A3B8', cursor: 'pointer', padding: 4 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  champ: { width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' },
  bouton: { padding: '10px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  succes: { fontSize: 13.5, color: '#15803D', fontWeight: 600, textAlign: 'center', padding: '10px 0' },
};
