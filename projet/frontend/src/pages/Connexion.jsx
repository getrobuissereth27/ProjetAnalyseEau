import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Connexion() {
  const [email, setEmail] = useState('caepa@demo.local');
  const [motDePasse, setMotDePasse] = useState('motdepasse123');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const { connexion } = useAuth();
  const navigate = useNavigate();

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await connexion(email, motDePasse);
      navigate('/');
    } catch (err) {
      setErreur('Email ou mot de passe incorrect.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={styles.page}>
      <form style={styles.carte} onSubmit={soumettre}>
        <div style={styles.brandIcon}>💧</div>
        <h1 style={styles.titre}>AquaSuivi</h1>
        <p style={styles.sousTitre}>Connexion à votre tableau de bord</p>

        {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

        <label style={styles.label}>Email</label>
        <input style={styles.champ} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label style={styles.label}>Mot de passe</label>
        <input style={styles.champ} type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />

        <button style={styles.bouton} type="submit" disabled={enCours}>
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>

        <p style={styles.aide}>
          Comptes de démonstration (créés par <code>npm run seed</code>) :<br />
          <code>caepa@demo.local</code> (responsable) ou <code>admin@demo.local</code> (admin)<br />
          mot de passe : <code>motdepasse123</code>
        </p>
      </form>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9' },
  carte: { background: 'white', padding: '36px 32px', borderRadius: 16, width: 360, border: '1px solid #E2E8F0' },
  brandIcon: { width: 44, height: 44, background: '#0F766E', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 },
  titre: { fontSize: 20, color: '#0F172A', marginBottom: 4 },
  sousTitre: { fontSize: 13, color: '#64748B', marginBottom: 20 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginTop: 14, marginBottom: 6 },
  champ: { width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5 },
  bouton: { width: '100%', marginTop: 22, padding: '10px 0', background: '#0F766E', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  aide: { marginTop: 18, fontSize: 11, color: '#94A3B8', lineHeight: 1.6 },
};
