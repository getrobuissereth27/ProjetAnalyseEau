import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';

const LIBELLES_ROLE = { administrateur: 'Administrateur', communautaire: 'Responsable CAEPA' };

export default function Utilisateurs() {
  const { utilisateur: moi, mettreAJourUtilisateur } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const [formOuvert, setFormOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState('communautaire');
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreurAjout, setErreurAjout] = useState(null);
  const [editionId, setEditionId] = useState(null);
  const [editionNom, setEditionNom] = useState('');
  const [editionEmail, setEditionEmail] = useState('');
  const [modificationEnCours, setModificationEnCours] = useState(false);
  const [erreurEdition, setErreurEdition] = useState(null);

  const charger = () => {
    client.get('/api/utilisateurs')
      .then((res) => setUtilisateurs(res.data))
      .catch(() => setErreur("Impossible de charger les utilisateurs."))
      .finally(() => setChargement(false));
  };

  useEffect(charger, []);

  const ajouterUtilisateur = async (e) => {
    e.preventDefault();
    setErreurAjout(null);
    setAjoutEnCours(true);
    try {
      await client.post('/api/utilisateurs', { nom, email, motDePasse, role });
      setNom(''); setEmail(''); setMotDePasse(''); setRole('communautaire');
      setFormOuvert(false);
      charger();
    } catch (err) {
      setErreurAjout(err.response?.data?.erreur || "Impossible d'ajouter cet utilisateur.");
    } finally {
      setAjoutEnCours(false);
    }
  };

  const changerRole = async (id, nouveauRole) => {
    try {
      await client.patch(`/api/utilisateurs/${id}/role`, { role: nouveauRole });
      charger();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible de changer ce rôle.");
    }
  };

  const commencerEdition = (u) => {
    setEditionId(u._id);
    setEditionNom(u.nom);
    setEditionEmail(u.email);
    setErreurEdition(null);
  };

  const annulerEdition = () => {
    setEditionId(null);
    setErreurEdition(null);
  };

  const enregistrerEdition = async (id) => {
    setErreurEdition(null);
    if (!editionNom.trim() || !editionEmail.trim()) {
      setErreurEdition('Le nom et l\'email ne peuvent pas être vides.');
      return;
    }
    setModificationEnCours(true);
    try {
      const res = await client.patch(`/api/utilisateurs/${id}`, { nom: editionNom.trim(), email: editionEmail.trim() });
      if (id === moi?.id) mettreAJourUtilisateur({ nom: res.data.nom, email: res.data.email });
      setEditionId(null);
      charger();
    } catch (err) {
      setErreurEdition(err.response?.data?.erreur || "Impossible d'enregistrer ces modifications.");
    } finally {
      setModificationEnCours(false);
    }
  };

  const supprimer = async (id, nomCible) => {
    if (!window.confirm(`Supprimer le compte de ${nomCible} ? Cette action est irréversible.`)) return;
    try {
      await client.delete(`/api/utilisateurs/${id}`);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible de supprimer cet utilisateur.");
    }
  };

  return (
    <Layout titre="Utilisateurs et rôles" sousTitre="Gestion des comptes ayant accès à l'application">
      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel">
        <div className="panel-header">
          <h2>Comptes ({utilisateurs.length})</h2>
          <button style={styles.boutonAjouter} onClick={() => setFormOuvert((v) => !v)}>
            {formOuvert ? 'Annuler' : '+ Ajouter un utilisateur'}
          </button>
        </div>

        {formOuvert && (
          <form onSubmit={ajouterUtilisateur} style={styles.formulaire}>
            {erreurAjout && <div className="erreur-connexion" style={{ marginBottom: 12 }}>⚠ {erreurAjout}</div>}
            <div style={styles.ligneForm}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Nom complet</label>
                <input style={styles.champForm} value={nom} onChange={(e) => setNom(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Email</label>
                <input type="email" style={styles.champForm} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div style={styles.ligneForm}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Mot de passe temporaire</label>
                <input type="password" style={styles.champForm} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} minLength={8} required />
              </div>
              <div style={{ width: 220 }}>
                <label style={styles.label}>Rôle</label>
                <select style={styles.champForm} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="communautaire">Responsable CAEPA</option>
                  <option value="administrateur">Administrateur</option>
                </select>
              </div>
            </div>
            <p style={styles.aideForm}>
              L'utilisateur pourra changer ce mot de passe lui-même après sa première connexion,
              depuis le menu en haut à droite.
            </p>
            <button type="submit" style={styles.boutonValider} disabled={ajoutEnCours}>
              {ajoutEnCours ? 'Ajout en cours…' : 'Créer le compte'}
            </button>
          </form>
        )}

        {chargement && <p className="chargement">Chargement…</p>}

        {!chargement && (
          <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 0' }}>Nom</th>
                <th style={{ padding: '10px 0' }}>Email</th>
                <th style={{ padding: '10px 0' }}>Rôle</th>
                <th style={{ padding: '10px 0' }}></th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map((u) => {
                const cestMoi = u._id === moi?.id;
                return (
                  <tr key={u._id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '14px 0', fontWeight: 700, fontSize: 13.5 }}>
                      {editionId === u._id ? (
                        <input
                          style={styles.champEdition}
                          value={editionNom}
                          onChange={(e) => setEditionNom(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') enregistrerEdition(u._id); if (e.key === 'Escape') annulerEdition(); }}
                        />
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {u.nom} {cestMoi && <span style={styles.puceMoi}>toi</span>}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 0', fontSize: 13, color: '#475569' }}>
                      {editionId === u._id ? (
                        <div>
                          <input
                            style={styles.champEdition}
                            type="email"
                            value={editionEmail}
                            onChange={(e) => setEditionEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') enregistrerEdition(u._id); if (e.key === 'Escape') annulerEdition(); }}
                          />
                          {erreurEdition && <p style={styles.erreurInline}>⚠ {erreurEdition}</p>}
                        </div>
                      ) : u.email}
                    </td>
                    <td style={{ padding: '14px 0' }}>
                      <select
                        style={styles.selectRole}
                        value={u.role}
                        onChange={(e) => changerRole(u._id, e.target.value)}
                        disabled={cestMoi}
                        title={cestMoi ? 'Tu ne peux pas changer ton propre rôle' : ''}
                      >
                        <option value="communautaire">{LIBELLES_ROLE.communautaire}</option>
                        <option value="administrateur">{LIBELLES_ROLE.administrateur}</option>
                      </select>
                    </td>
                    <td style={{ padding: '14px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {editionId === u._id ? (
                        <>
                          <button style={styles.boutonMini} onClick={() => enregistrerEdition(u._id)} disabled={modificationEnCours}>
                            {modificationEnCours ? '…' : '✔ Enregistrer'}
                          </button>{' '}
                          <button style={styles.boutonMini} onClick={annulerEdition}>✕ Annuler</button>
                        </>
                      ) : (
                        <>
                          <button style={styles.boutonModifier} onClick={() => commencerEdition(u)}>
                            ✏️ Modifier
                          </button>{' '}
                          {!cestMoi && (
                            <button style={styles.boutonSuppr} onClick={() => supprimer(u._id, u.nom)}>
                              Supprimer
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  boutonAjouter: { padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  formulaire: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 18, marginTop: 4, marginBottom: 8 },
  ligneForm: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  champForm: { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  aideForm: { fontSize: 11.5, color: '#94A3B8', margin: '4px 0 14px', lineHeight: 1.5 },
  boutonValider: { padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  selectRole: { fontSize: 12.5, padding: '5px 8px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155' },
  boutonSuppr: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid #FECACA', background: 'white', color: '#B91C1C', cursor: 'pointer' },
  puceMoi: { fontSize: 10, fontWeight: 700, color: '#0F766E', background: '#CCFBF1', padding: '2px 7px', borderRadius: 999, marginLeft: 6 },
  boutonModifier: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer' },
  champEdition: { fontSize: 13, padding: '5px 8px', border: '1px solid #0F766E', borderRadius: 6, width: '100%', minWidth: 160, boxSizing: 'border-box' },
  boutonMini: { fontSize: 11.5, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' },
  erreurInline: { fontSize: 11, color: '#B91C1C', marginTop: 4 },
};
