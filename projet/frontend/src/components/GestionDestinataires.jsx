import { useEffect, useState } from 'react';
import client from '../api/client';
import { useSite } from '../sites/SiteContext';

export default function GestionDestinataires() {
  const { siteActifId } = useSite();
  const [destinataires, setDestinataires] = useState([]);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const charger = () => {
    if (!siteActifId) return;
    client.get(`/api/destinataires?site=${siteActifId}`)
      .then((res) => setDestinataires(res.data))
      .catch(() => setErreur('Impossible de charger les destinataires.'))
      .finally(() => setChargement(false));
  };

  useEffect(charger, [siteActifId]);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur(null);
    setAjoutEnCours(true);
    try {
      await client.post('/api/destinataires', { site_id: siteActifId, email: email.trim(), nom: nom.trim() });
      setNom('');
      setEmail('');
      charger();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Impossible d'ajouter ce destinataire.");
    } finally {
      setAjoutEnCours(false);
    }
  };

  const basculerActif = async (id, actif) => {
    try {
      await client.patch(`/api/destinataires/${id}`, { actif: !actif });
      charger();
    } catch (err) {
      setErreur('Impossible de modifier ce destinataire.');
    }
  };

  const supprimer = async (id) => {
    if (!window.confirm('Retirer ce destinataire des notifications par email ?')) return;
    try {
      await client.delete(`/api/destinataires/${id}`);
      charger();
    } catch (err) {
      setErreur('Impossible de supprimer ce destinataire.');
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-header">
        <h2>Destinataires des alertes par email</h2>
      </div>

      {erreur && <div className="erreur-connexion" style={{ marginBottom: 12 }}>⚠ {erreur}</div>}

      <form onSubmit={ajouter} style={styles.formulaire}>
        <input
          placeholder="Nom (optionnel)" value={nom} onChange={(e) => setNom(e.target.value)}
          style={{ ...styles.champ, width: 180 }}
        />
        <input
          type="email" placeholder="email@exemple.com" value={email}
          onChange={(e) => setEmail(e.target.value)} style={{ ...styles.champ, flex: 1, minWidth: 220 }} required
        />
        <button type="submit" style={styles.bouton} disabled={ajoutEnCours}>
          {ajoutEnCours ? 'Ajout…' : '+ Ajouter'}
        </button>
      </form>

      {chargement && <p className="chargement">Chargement…</p>}

      {!chargement && destinataires.length === 0 && (
        <p className="chargement">Aucun destinataire configuré — les alertes ne seront envoyées par email à personne.</p>
      )}

      {destinataires.map((d) => (
        <div key={d._id} style={styles.ligne}>
          <div style={{ flex: 1 }}>
            <p style={styles.nomDest}>{d.nom || d.email}</p>
            {d.nom && <p style={styles.emailDest}>{d.email}</p>}
          </div>
          <label style={styles.toggle}>
            <input type="checkbox" checked={d.actif} onChange={() => basculerActif(d._id, d.actif)} />
            {d.actif ? 'Actif' : 'En pause'}
          </label>
          <button style={styles.boutonSuppr} onClick={() => supprimer(d._id)}>Retirer</button>
        </div>
      ))}
    </div>
  );
}

const styles = {
  formulaire: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  champ: { padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' },
  bouton: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0F766E', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  ligne: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: '1px solid #F1F5F9' },
  nomDest: { fontSize: 13.5, fontWeight: 600, color: '#0F172A' },
  emailDest: { fontSize: 12, color: '#64748B' },
  toggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', whiteSpace: 'nowrap' },
  boutonSuppr: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: '1px solid #FECACA', background: 'white', color: '#B91C1C', cursor: 'pointer' },
};
