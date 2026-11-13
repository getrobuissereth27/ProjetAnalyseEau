import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../sites/SiteContext';
import { useConfirmer } from '../confirm/ConfirmContext';
import { LIBELLES_ROLE, estSuperAdmin } from '../utils/roles';

// Le superadmin gère tous les comptes et attribue les sites aux administrateurs.
// Un administrateur gère les responsables (CAEPA) de ses propres sites.
export default function Utilisateurs() {
  const { utilisateur: moi, mettreAJourUtilisateur } = useAuth();
  const { sites } = useSite(); // sites accessibles à l'utilisateur connecté (tous pour le superadmin)
  const superAdmin = estSuperAdmin(moi);
  const confirmer = useConfirmer();
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const [formOuvert, setFormOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState('communautaire');
  const [sitesNouveau, setSitesNouveau] = useState([]);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreurAjout, setErreurAjout] = useState(null);

  const [editionId, setEditionId] = useState(null);
  const [editionNom, setEditionNom] = useState('');
  const [editionEmail, setEditionEmail] = useState('');
  const [modificationEnCours, setModificationEnCours] = useState(false);
  const [erreurEdition, setErreurEdition] = useState(null);

  // Édition des sites d'un compte
  const [sitesEditionId, setSitesEditionId] = useState(null);
  const [sitesEdition, setSitesEdition] = useState([]);
  const [erreurSites, setErreurSites] = useState(null);

  const nomSite = (id) => sites.find((s) => s._id === id)?.nom || 'Site inconnu';

  const charger = () => {
    client.get('/api/users')
      .then((res) => setUtilisateurs(res.data))
      .catch(() => setErreur("Impossible de charger les utilisateurs."))
      .finally(() => setChargement(false));
  };

  useEffect(charger, []);

  // Un administrateur ne gère que les responsables ; le superadmin gère tout le monde.
  const peutGerer = (u) => superAdmin || u.role === 'communautaire';

  const basculer = (liste, setListe, id) => {
    setListe(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
  };

  const ajouterUtilisateur = async (e) => {
    e.preventDefault();
    setErreurAjout(null);
    if (role !== 'superadmin' && sitesNouveau.length === 0) {
      setErreurAjout('Coche au moins un site pour ce compte.');
      return;
    }
    setAjoutEnCours(true);
    try {
      await client.post('/api/users', { nom, email, motDePasse, role, sites: sitesNouveau });
      setNom(''); setEmail(''); setMotDePasse(''); setRole('communautaire'); setSitesNouveau([]);
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
      await client.patch(`/api/users/${id}/role`, { role: nouveauRole });
      setErreur(null);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible de changer ce rôle.");
    }
  };

  const commencerEditionSites = (u) => {
    setSitesEditionId(u._id);
    setSitesEdition(u.sites || []);
    setErreurSites(null);
  };

  const enregistrerSites = async (id) => {
    setErreurSites(null);
    try {
      await client.patch(`/api/users/${id}/sites`, { sites: sitesEdition });
      setSitesEditionId(null);
      charger();
    } catch (err) {
      setErreurSites(err.response?.data?.erreur || "Impossible d'enregistrer ces sites.");
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
      const res = await client.patch(`/api/users/${id}`, { nom: editionNom.trim(), email: editionEmail.trim() });
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
    const ok = await confirmer({
      titre: 'Supprimer ce compte ?',
      message: `Le compte de ${nomCible} sera supprimé. Cette action est irréversible.`,
      texteConfirmer: 'Supprimer',
    });
    if (!ok) return;
    try {
      await client.delete(`/api/users/${id}`);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible de supprimer cet utilisateur.");
    }
  };

  const casesSites = (selection, setSelection) => (
    <div style={styles.listeSites}>
      {sites.length === 0 && <span style={styles.aucunSite}>Aucun site disponible</span>}
      {sites.map((s) => (
        <label key={s._id} style={styles.caseSite}>
          <input
            type="checkbox"
            checked={selection.includes(s._id)}
            onChange={() => basculer(selection, setSelection, s._id)}
          />
          {s.nom}
        </label>
      ))}
    </div>
  );

  return (
    <Layout
      titre="Utilisateurs et sites"
      sousTitre={superAdmin
        ? 'Gestion des comptes et attribution des sites aux administrateurs'
        : 'Gestion des responsables de tes sites'}
    >
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
                {superAdmin ? (
                  <select style={styles.champForm} value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="communautaire">{LIBELLES_ROLE.communautaire}</option>
                    <option value="administrateur">{LIBELLES_ROLE.administrateur}</option>
                    <option value="superadmin">{LIBELLES_ROLE.superadmin}</option>
                  </select>
                ) : (
                  <input style={styles.champForm} value={LIBELLES_ROLE.communautaire} disabled />
                )}
              </div>
            </div>
            {role !== 'superadmin' ? (
              <div style={{ marginBottom: 14 }}>
                <label style={styles.label}>Sites attribués *</label>
                {casesSites(sitesNouveau, setSitesNouveau)}
              </div>
            ) : (
              <p style={styles.aideForm}>Un super administrateur a accès à tous les sites.</p>
            )}
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 11.5, color: '#64748B', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 0' }}>Nom</th>
                  <th style={{ padding: '10px 0' }}>Email</th>
                  <th style={{ padding: '10px 0' }}>Rôle</th>
                  <th style={{ padding: '10px 0' }}>Sites</th>
                  <th style={{ padding: '10px 0' }}></th>
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => {
                  const cestMoi = u._id === moi?.id;
                  const gerable = peutGerer(u);
                  return (
                    <tr key={u._id} style={{ borderTop: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                      <td style={{ padding: '14px 8px 14px 0', fontWeight: 700, fontSize: 13.5 }}>
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
                      <td style={{ padding: '14px 8px 14px 0', fontSize: 13, color: '#475569' }}>
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
                      <td style={{ padding: '14px 8px 14px 0' }}>
                        {superAdmin ? (
                          <select
                            style={styles.selectRole}
                            value={u.role}
                            onChange={(e) => changerRole(u._id, e.target.value)}
                            disabled={cestMoi}
                            title={cestMoi ? 'Tu ne peux pas changer ton propre rôle' : ''}
                          >
                            <option value="communautaire">{LIBELLES_ROLE.communautaire}</option>
                            <option value="administrateur">{LIBELLES_ROLE.administrateur}</option>
                            <option value="superadmin">{LIBELLES_ROLE.superadmin}</option>
                          </select>
                        ) : (
                          <span style={styles.texteRole}>{LIBELLES_ROLE[u.role] || u.role}</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 8px 14px 0', fontSize: 12.5 }}>
                        {u.role === 'superadmin' ? (
                          <span style={styles.aucunSite}>Tous les sites</span>
                        ) : sitesEditionId === u._id ? (
                          <div>
                            {casesSites(sitesEdition, setSitesEdition)}
                            {erreurSites && <p style={styles.erreurInline}>⚠ {erreurSites}</p>}
                            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                              <button style={styles.boutonMini} onClick={() => enregistrerSites(u._id)}>✔ Enregistrer</button>
                              <button style={styles.boutonMini} onClick={() => setSitesEditionId(null)}>✕ Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {(u.sites || []).length === 0 && <span style={styles.aucunSite}>Aucun site</span>}
                            {(u.sites || []).map((id) => <span key={id} style={styles.puceSite}>{nomSite(id)}</span>)}
                            {gerable && !cestMoi && (
                              <button style={styles.boutonLien} onClick={() => commencerEditionSites(u)}>
                                Modifier
                              </button>
                            )}
                          </div>
                        )}
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
                            {(gerable || cestMoi) && (
                              <button style={styles.boutonModifier} onClick={() => commencerEdition(u)}>
                                Modifier
                              </button>
                            )}{' '}
                            {gerable && !cestMoi && (
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
          </div>
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
  texteRole: { fontSize: 12.5, color: '#334155' },
  boutonSuppr: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid #FECACA', background: 'white', color: '#B91C1C', cursor: 'pointer' },
  puceMoi: { fontSize: 10, fontWeight: 700, color: '#0F766E', background: '#CCFBF1', padding: '2px 7px', borderRadius: 999, marginLeft: 6 },
  puceSite: { fontSize: 11, fontWeight: 600, color: '#0F766E', background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '2px 8px', borderRadius: 999 },
  aucunSite: { fontSize: 11.5, color: '#94A3B8', fontStyle: 'italic' },
  listeSites: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' },
  caseSite: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#334155', cursor: 'pointer' },
  boutonModifier: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer' },
  boutonLien: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: '1px dashed #CBD5E1', background: 'white', color: '#475569', cursor: 'pointer' },
  champEdition: { fontSize: 13, padding: '5px 8px', border: '1px solid #0F766E', borderRadius: 6, width: '100%', minWidth: 160, boxSizing: 'border-box' },
  boutonMini: { fontSize: 11.5, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' },
  erreurInline: { fontSize: 11, color: '#B91C1C', marginTop: 4 },
};
