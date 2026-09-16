import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import { useSite } from '../sites/SiteContext';

export default function NotificationsEmail() {
  const { siteActifId, sites } = useSite();
  const [destinataires, setDestinataires] = useState([]);
  const [email, setEmail] = useState('');
  const [erreur, setErreur] = useState(null);
  const [erreurForm, setErreurForm] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const siteActif = sites.find((s) => s._id === siteActifId);

  const charger = () => {
    if (!siteActifId) return;
    client.get(`/api/destinataires?site=${siteActifId}`)
      .then((res) => setDestinataires(res.data))
      .catch(() => setErreur("Impossible de charger les destinataires."));
  };

  useEffect(charger, [siteActifId]);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreurForm(null);
    if (!email.trim()) return;

    setEnCours(true);
    try {
      await client.post('/api/destinataires', { site_id: siteActifId, email: email.trim() });
      setEmail('');
      charger();
    } catch (err) {
      setErreurForm(err.response?.data?.erreur || "Impossible d'ajouter cette adresse.");
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (d) => {
    if (!window.confirm(`Retirer ${d.email} des destinataires d'alerte de ce site ?`)) return;
    try {
      await client.delete(`/api/destinataires/${d._id}`);
      charger();
    } catch (err) {
      setErreur("Impossible de supprimer ce destinataire.");
    }
  };

  return (
    <Layout titre="Alertes par email" sousTitre={siteActif ? `Destinataires pour « ${siteActif.nom} »` : ''}>
      <div style={styles.banniereRole}>
        🔒 Page réservée au rôle Administrateur — chaque site a sa propre liste de destinataires
      </div>

      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header"><h2>Ajouter un destinataire</h2></div>
        <form onSubmit={ajouter} style={styles.ligneForm}>
          {erreurForm && <div className="erreur-connexion" style={{ marginBottom: 12, flexBasis: '100%' }}>⚠ {erreurForm}</div>}
          <input
            style={styles.champ} type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex : responsable@caepa-site1.org" required
          />
          <button type="submit" style={styles.boutonValider} disabled={enCours}>
            {enCours ? 'Ajout…' : '+ Ajouter'}
          </button>
        </form>
        <p style={styles.aide}>
          Chaque adresse ajoutée ici reçoit automatiquement un email dès qu'une alerte se déclenche sur ce site
          — avec les mêmes informations que le panneau de détail d'une alerte (paramètre, valeur mesurée, seuil,
          date, état de la vanne).
        </p>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>{destinataires.length} destinataire(s)</h2></div>
        {destinataires.length === 0 && (
          <p className="chargement">Aucun destinataire configuré — personne ne recevra d'email en cas d'alerte sur ce site.</p>
        )}
        {destinataires.map((d) => (
          <div className="alert-row" key={d._id}>
            <div className="alert-icon gray">✉</div>
            <div style={{ flex: 1 }}>
              <div className="alert-title">{d.email}</div>
              <div className="alert-meta">Ajouté le {new Date(d.createdAt).toLocaleDateString('fr-FR')}</div>
            </div>
            <button style={styles.btnSupprimer} onClick={() => supprimer(d)}>Retirer</button>
          </div>
        ))}
      </div>
    </Layout>
  );
}

const styles = {
  banniereRole: { display: 'flex', alignItems: 'center', gap: 10, background: '#EDE9FE', color: '#5B21B6', borderRadius: 10, padding: '10px 16px', margin: '0 0 20px 0', fontSize: 12.5, fontWeight: 600 },
  ligneForm: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  champ: { flex: 1, minWidth: 220, padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5 },
  boutonValider: { padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  aide: { fontSize: 11.5, color: '#94A3B8', marginTop: 12, lineHeight: 1.6 },
  btnSupprimer: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', whiteSpace: 'nowrap' },
};
