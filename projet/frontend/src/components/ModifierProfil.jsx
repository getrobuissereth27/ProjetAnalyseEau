import { useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function ModifierProfil({ onFermer }) {
  const { utilisateur, mettreAJourUtilisateur } = useAuth();
  const [nom, setNom] = useState(utilisateur?.nom || '');
  const [email, setEmail] = useState(utilisateur?.email || '');
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const emailModifie = email.trim().toLowerCase() !== (utilisateur?.email || '').toLowerCase();
  const nomModifie = nom.trim() !== utilisateur?.nom;

  const valider = async (e) => {
    e.preventDefault();
    setErreur(null);

    if (!nom.trim()) {
      setErreur('Le nom ne peut pas être vide.');
      return;
    }
    if (!email.trim()) {
      setErreur("L'email ne peut pas être vide.");
      return;
    }
    if (emailModifie && !motDePasseActuel) {
      setErreur('Le mot de passe actuel est requis pour changer ton email.');
      return;
    }
    if (!emailModifie && !nomModifie) {
      onFermer();
      return;
    }

    setEnCours(true);
    try {
      const payload = {};
      if (nomModifie) payload.nom = nom.trim();
      if (emailModifie) {
        payload.email = email.trim();
        payload.motDePasseActuel = motDePasseActuel;
      }

      const res = await client.patch('/api/utilisateurs/moi', payload);
      mettreAJourUtilisateur({ nom: res.data.nom, email: res.data.email });
      setSucces(true);
      setTimeout(onFermer, 1200);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Impossible de modifier le profil.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={styles.fond} onClick={onFermer}>
      <div style={styles.panneau} onClick={(e) => e.stopPropagation()}>
        <div style={styles.entete}>
          <h3 style={styles.titre}>Modifier mon profil</h3>
          <button style={styles.boutonFermer} onClick={onFermer}>✕</button>
        </div>

        {succes ? (
          <p style={styles.succes}>✔ Profil modifié avec succès.</p>
        ) : (
          <form onSubmit={valider} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

            <div>
              <label style={styles.label}>Nom affiché</label>
              <input
                type="text" style={styles.champ} value={nom}
                onChange={(e) => setNom(e.target.value)} required autoFocus
              />
            </div>

            <div>
              <label style={styles.label}>Email</label>
              <input
                type="email" style={styles.champ} value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </div>

            {emailModifie && (
              <div>
                <label style={styles.label}>Mot de passe actuel (requis pour changer d'email)</label>
                <input
                  type="password" style={styles.champ} value={motDePasseActuel}
                  onChange={(e) => setMotDePasseActuel(e.target.value)} required
                />
              </div>
            )}

            <button type="submit" style={styles.bouton} disabled={enCours}>
              {enCours ? 'Modification…' : 'Enregistrer'}
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
