import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../sites/SiteContext';
import { estSuperAdmin } from '../utils/roles';

// Adresse réseau du Raspberry Pi du site actif.
// Le super administrateur la saisit et peut tester la connexion ;
// les administrateurs la voient en lecture seule.
export default function RaspberrySite() {
  const { utilisateur } = useAuth();
  const { sites, siteActifId, chargerSites } = useSite();
  const site = sites.find((s) => s._id === siteActifId);
  const superAdmin = estSuperAdmin(utilisateur);

  const [ip, setIp] = useState('');
  const [port, setPort] = useState('22');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'erreur', texte }
  const [statut, setStatut] = useState(null);
  const [testEnCours, setTestEnCours] = useState(false);

  useEffect(() => {
    setIp(site?.ipRaspberry || '');
    setPort(String(site?.portRaspberry || 22));
    setMessage(null);
    setStatut(null);
  }, [site?._id, site?.ipRaspberry, site?.portRaspberry]);

  if (!site) return null;

  const modifie = ip.trim() !== (site.ipRaspberry || '') || Number(port) !== (site.portRaspberry || 22);

  const enregistrer = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    setStatut(null);
    try {
      await client.patch(`/api/sites/${site._id}`, { ipRaspberry: ip.trim(), portRaspberry: Number(port) });
      await chargerSites();
      setMessage({ type: 'ok', texte: ip.trim() ? 'Adresse enregistrée.' : 'Adresse effacée.' });
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.response?.data?.erreur || "Impossible d'enregistrer l'adresse." });
    } finally {
      setEnCours(false);
    }
  };

  const tester = async () => {
    setTestEnCours(true);
    setStatut(null);
    setMessage(null);
    try {
      const res = await client.get(`/api/sites/${site._id}/raspberry/statut`);
      setStatut(res.data);
    } catch (err) {
      setMessage({ type: 'erreur', texte: err.response?.data?.erreur || 'Test impossible.' });
    } finally {
      setTestEnCours(false);
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-header">
        <h2>Raspberry Pi du site</h2>
        <span className="tag">{site.ipRaspberry ? `${site.ipRaspberry}:${site.portRaspberry || 22}` : 'Adresse non renseignée'}</span>
      </div>

      {superAdmin ? (
        <form onSubmit={enregistrer} style={styles.formulaire}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={styles.label} htmlFor="ip-raspberry">Adresse IP (ou nom d'hôte)</label>
            <input
              id="ip-raspberry"
              style={styles.champ}
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="ex : 192.168.1.50"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div style={{ flex: '0 0 110px' }}>
            <label style={styles.label} htmlFor="port-raspberry">Port</label>
            <input
              id="port-raspberry"
              style={styles.champ}
              type="number"
              min="1"
              max="65535"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
          <div style={styles.actions}>
            <button type="submit" style={styles.bouton} disabled={enCours || !modifie}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              style={styles.boutonSecondaire}
              onClick={tester}
              disabled={testEnCours || modifie || !site.ipRaspberry}
              title={modifie ? "Enregistre d'abord l'adresse" : ''}
            >
              {testEnCours ? 'Test…' : 'Tester la connexion'}
            </button>
          </div>
        </form>
      ) : (
        <p style={styles.lectureSeule}>
          {site.ipRaspberry
            ? <>Adresse : <strong>{site.ipRaspberry}</strong> (port {site.portRaspberry || 22})</>
            : 'Aucune adresse renseignée.'}
          {' '}Seul le super administrateur peut la modifier.
        </p>
      )}

      {message && (
        <p style={{ ...styles.message, color: message.type === 'ok' ? '#15803D' : '#B91C1C' }}>
          {message.type === 'ok' ? '✓' : '⚠'} {message.texte}
        </p>
      )}

      {statut && (
        <div style={{ ...styles.statut, ...(statut.joignable ? styles.statutOk : styles.statutKo) }}>
          <strong>{statut.joignable ? '● En ligne' : '● Injoignable'}</strong>
          {statut.joignable
            ? ` — répond sur ${statut.ip}:${statut.port} (${statut.latenceMs} ms)`
            : ` — ${statut.raison}`}
          <div style={styles.dernierContact}>
            Dernière mesure reçue :{' '}
            {statut.dernierContact ? new Date(statut.dernierContact).toLocaleString('fr-FR') : 'aucune'}
          </div>
        </div>
      )}

      {superAdmin && (
        <p style={styles.aide}>
          Le test vérifie que le Raspberry répond sur ce port (22 = SSH, actif par défaut sur Raspberry Pi OS).
          Donnez-lui une IP fixe (réservation DHCP sur la box) pour qu'elle ne change pas.
        </p>
      )}
    </div>
  );
}

const styles = {
  formulaire: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  label: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  champ: { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  bouton: { padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', background: '#0F766E', color: 'white', cursor: 'pointer' },
  boutonSecondaire: { padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer' },
  lectureSeule: { fontSize: 13, color: '#334155', lineHeight: 1.6 },
  message: { fontSize: 12.5, marginTop: 10, fontWeight: 600 },
  statut: { marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5 },
  statutOk: { background: '#DCFCE7', color: '#15803D' },
  statutKo: { background: '#FEE2E2', color: '#B91C1C' },
  dernierContact: { color: '#334155', marginTop: 2 },
  aide: { fontSize: 11.5, color: '#94A3B8', marginTop: 12, lineHeight: 1.5 },
};
