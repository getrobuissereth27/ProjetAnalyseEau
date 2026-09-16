import { useEffect, useState } from 'react';
import client from '../api/client';
import Layout from '../components/Layout';
import DetailAlerte from '../components/DetailAlerte';
import { useSite } from '../sites/SiteContext';
import { exporterAlertesCSV, exporterAlertesExcel } from '../utils/export';

export default function Alertes() {
  const { siteActifId } = useSite();
  const [donnees, setDonnees] = useState({ resultats: [], total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [erreur, setErreur] = useState(null);
  const [seuils, setSeuils] = useState([]);
  const [vanneActuelle, setVanneActuelle] = useState(null);
  const [alerteSelectionnee, setAlerteSelectionnee] = useState(null);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const LIMITE = 15;

  useEffect(() => {
    if (!siteActifId) return;
    const params = new URLSearchParams({ page, limite: LIMITE, site: siteActifId });
    if (filtreStatut) params.set('statut', filtreStatut);

    client.get(`/api/alertes?${params.toString()}`)
      .then((res) => setDonnees(res.data))
      .catch(() => setErreur("Impossible de charger les alertes."));

    client.get(`/api/seuils?site=${siteActifId}`).then((res) => setSeuils(res.data)).catch(() => {});
    client.get(`/api/vanne/etat?site=${siteActifId}`).then((res) => setVanneActuelle(res.data)).catch(() => {});
  }, [page, filtreStatut, siteActifId]);

  const changerFiltre = (statut) => {
    setFiltreStatut(statut);
    setPage(1);
  };

  const seuilDuCapteur = (capteurId) => seuils.find((s) => s.capteur_id?._id === capteurId);

  const telechargerToutesLesAlertes = async (format) => {
    if (!siteActifId) return;
    setTelechargementEnCours(true);
    try {
      const params = new URLSearchParams({ page: 1, limite: 100, site: siteActifId });
      if (filtreStatut) params.set('statut', filtreStatut);
      const res = await client.get(`/api/alertes?${params.toString()}`);
      if (format === 'csv') exporterAlertesCSV(res.data.resultats, 'alertes.csv');
      else exporterAlertesExcel(res.data.resultats, 'alertes.xlsx');
    } catch (err) {
      setErreur("Impossible d'exporter les alertes.");
    } finally {
      setTelechargementEnCours(false);
    }
  };

  return (
    <Layout titre="Alertes" sousTitre={`${donnees.total} alerte(s) au total`}>
      {erreur && <div className="erreur-connexion">⚠ {erreur}</div>}

      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Historique des alertes</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { valeur: '', libelle: 'Toutes' },
              { valeur: 'active', libelle: 'Actives' },
              { valeur: 'resolue', libelle: 'Résolues' },
            ].map((opt) => (
              <button
                key={opt.valeur}
                onClick={() => changerFiltre(opt.valeur)}
                style={{
                  ...styles.filtreBtn,
                  ...(filtreStatut === opt.valeur ? styles.filtreBtnActif : {}),
                }}
              >
                {opt.libelle}
              </button>
            ))}
            <button style={styles.btnSecondaire} onClick={() => telechargerToutesLesAlertes('csv')} disabled={telechargementEnCours || donnees.total === 0}>
              ⬇ Export CSV
            </button>
            <button style={styles.btnSecondaire} onClick={() => telechargerToutesLesAlertes('excel')} disabled={telechargementEnCours || donnees.total === 0}>
              ⬇ Export Excel
            </button>
          </div>
        </div>

        {donnees.resultats.length === 0 && <p className="chargement">Aucune alerte à afficher.</p>}
        {donnees.resultats.map((a) => (
          <div
            className="alert-row"
            key={a._id}
            style={{ cursor: 'pointer' }}
            onClick={() => setAlerteSelectionnee(a)}
          >
            <div className={`alert-icon ${a.statut === 'active' ? 'amber' : 'gray'}`}>
              {a.statut === 'active' ? '!' : '✓'}
            </div>
            <div style={{ flex: 1 }}>
              <div className="alert-title">{a.type_alerte}</div>
              <div className="alert-meta">
                {a.mesure_id?.capteur_id?.type ?? '?'} · {new Date(a.horodatage).toLocaleString('fr-FR')}
              </div>
            </div>
            <span className={`alert-status ${a.statut === 'active' ? 'active' : 'resolved'}`}>
              {a.statut === 'active' ? 'Active' : 'Résolue'}
            </span>
            <span style={styles.chevron}>›</span>
          </div>
        ))}

        {donnees.totalPages > 1 && (
          <div style={styles.pagination}>
            <button
              style={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Précédent
            </button>
            <span style={{ fontSize: 12.5, color: '#64748B' }}>
              Page {donnees.page} / {donnees.totalPages}
            </span>
            <button
              style={styles.pageBtn}
              disabled={page >= donnees.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {alerteSelectionnee && (
        <DetailAlerte
          alerte={alerteSelectionnee}
          seuil={seuilDuCapteur(alerteSelectionnee.mesure_id?.capteur_id?._id)}
          vanneActuelle={vanneActuelle}
          onFermer={() => setAlerteSelectionnee(null)}
        />
      )}
    </Layout>
  );
}

const styles = {
  filtreBtn: { fontSize: 12, padding: '5px 12px', borderRadius: 999, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer' },
  filtreBtnActif: { background: '#0F172A', color: 'white', borderColor: '#0F172A' },
  btnSecondaire: { fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: '1px solid #E2E8F0', background: 'white', color: '#334155', cursor: 'pointer' },
  chevron: { fontSize: 18, color: '#CBD5E1', marginLeft: 4 },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 18, paddingTop: 14, borderTop: '1px solid #E2E8F0' },
  pageBtn: { fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#0F172A', cursor: 'pointer' },
};
