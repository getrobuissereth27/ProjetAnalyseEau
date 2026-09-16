import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';

export default function Utilisateurs() {
  const { utilisateur: moi } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [utilisateurEnEdition, setUtilisateurEnEdition] = useState(null);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState('communautaire');
  const [enCours, setEnCours] = useState(false);
  const [erreurForm, setErreurForm] = useState(null);

  const charger = () => {
    client.get('/api/utilisateurs')
      .then((res) => setUtilisateurs(res.data))
      .catch(() => setErreur("Impossible de charger les utilisateurs."));
  };

  useEffect(charger, []);

  const reinitialiserForm = () => {
    setNom(''); setEmail(''); setMotDePasse(''); setRole('communautaire');
    setUtilisateurEnEdition(null); setErreurForm(null);
  };

  const ouvrirAjout = () => { reinitialiserForm(); setFormOuvert(true); };
  const ouvrirEdition = (u) => {
    setUtilisateurEnEdition(u);
    setNom(u.nom); setEmail(u.email); setMotDePasse(''); setRole(u.role);
    setErreurForm(null);
    setFormOuvert(true);
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setErreurForm(null);
    setEnCours(true);
    try {
      if (utilisateurEnEdition) {
        await client.put(`/api/utilisateurs/${utilisateurEnEdition.id}`, { nom, email, role });
      } else {
        if (motDePasse.length < 8) {
          setErreurForm('Le mot de passe doit contenir au moins 8 caractères.');
          setEnCours(false);
          return;
        }
        await client.post('/api/utilisateurs', { nom, email, motDePasse, role });
      }
      setFormOuvert(false);
      reinitialiserForm();
      charger();
    } catch (err) {
      setErreurForm(err.response?.data?.erreur || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (u) => {
    if (!window.confirm(`Supprimer le compte de ${u.nom} (${u.email}) ? Cette action est irréversible.`)) return;
    try {
      await client.delete(`/api/utilisateurs/${u.id}`);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible de supprimer cet utilisateur.");
    }
  };

  return (
    <Layout titre="Utilisateurs" sousTitre="Gestion des comptes et des rôles d'accès">
      <div style={styles.banniereRole}>
        🔒 Page réservée au rôle Administrateur
      </div>

      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>{utilisateurs.length} compte(s)</h2>
          <button style={styles.boutonAjouter} onClick={ouvrirAjout}>
            {formOuvert && !utilisateurEnEdition ? 'Annuler' : '+ Ajouter un utilisateur'}
          </button>
        </div>

        {formOuvert && (
          <form onSubmit={soumettre} style={styles.formulaire}>
            {erreurForm && <div className="erreur-connexion" style={{ marginBottom: 12 }}>⚠ {erreurForm}</div>}
            <p style={styles.titreForm}>{utilisateurEnEdition ? `Modifier ${utilisateurEnEdition.nom}` : 'Nouvel utilisateur'}</p>

            <div style={styles.ligneForm}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Nom complet</label>
                <input style={styles.champForm} value={nom} onChange={(e) => setNom(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Email</label>
                <input style={styles.champForm} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div style={styles.ligneForm}>
              {!utilisateurEnEdition && (
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Mot de passe initial</label>
                  <input style={styles.champForm} type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="8 caractères minimum" required />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Rôle</label>
                <select style={styles.champForm} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="communautaire">Responsable communautaire</option>
                  <option value="administrateur">Administrateur</option>
                </select>
              </div>
            </div>

            <button type="submit" style={styles.boutonValider} disabled={enCours}>
              {enCours ? 'Enregistrement…' : (utilisateurEnEdition ? 'Enregistrer les modifications' : 'Créer le compte')}
            </button>
          </form>
        )}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 0' }}>Nom</th>
              <th style={{ padding: '10px 0' }}>Email</th>
              <th style={{ padding: '10px 0' }}>Rôle</th>
              <th style={{ padding: '10px 0' }}></th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 0', fontWeight: 700, fontSize: 13.5 }}>
                  {u.nom}{u.id === moi?.id && <span style={styles.puceMoi}>vous</span>}
                </td>
                <td style={{ padding: '12px 0', fontSize: 13, color: '#334155' }}>{u.email}</td>
                <td style={{ padding: '12px 0' }}>
                  <span style={{ ...styles.badgeRole, ...(u.role === 'administrateur' ? styles.badgeAdmin : styles.badgeCommunautaire) }}>
                    {u.role === 'administrateur' ? 'Administrateur' : 'Responsable communautaire'}
                  </span>
                </td>
                <td style={{ padding: '12px 0', whiteSpace: 'nowrap' }}>
                  <button style={styles.btnLien} onClick={() => ouvrirEdition(u)}>Modifier</button>
                  {u.id !== moi?.id && (
                    <button style={{ ...styles.btnLien, color: '#B91C1C' }} onClick={() => supprimer(u)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
            {utilisateurs.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '14px 0', color: '#64748B' }}>Aucun utilisateur.</td></tr>
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
  titreForm: { fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 },
  ligneForm: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  champForm: { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 },
  boutonValider: { padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  badgeRole: { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 },
  badgeAdmin: { background: '#EDE9FE', color: '#5B21B6' },
  badgeCommunautaire: { background: '#DBEAFE', color: '#1E3A8A' },
  puceMoi: { marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#0F766E', background: '#CCFBF1', padding: '2px 8px', borderRadius: 999 },
  btnLien: { background: 'none', border: 'none', color: '#0F766E', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginRight: 14, padding: 0 },
};
