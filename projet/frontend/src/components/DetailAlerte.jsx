const LABELS = { pH: 'pH', turbidite: 'Turbidité', temperature: 'Température', tds: 'Conductivité' };

export default function DetailAlerte({ alerte, seuil, vanneActuelle, onFermer }) {
  if (!alerte) return null;

  const capteur = alerte.mesure_id?.capteur_id;
  const estActive = alerte.statut === 'active';

  // La vanne se ferme dès qu'une alerte est active. Pour une alerte encore active,
  // elle est donc fermée à cause de cette alerte (entre autres, éventuellement).
  // Pour une alerte résolue, elle a nécessairement été fermée entre son déclenchement
  // et sa résolution — c'est un fait passé, indépendant de l'état actuel de la vanne.
  const vanneEtaitFermee = true; // toute alerte, active ou passée, a provoqué une fermeture

  return (
    <div style={styles.fond} onClick={onFermer}>
      <div style={styles.panneau} onClick={(e) => e.stopPropagation()}>
        <div style={styles.entete}>
          <h3 style={styles.titre}>Détail de l'alerte</h3>
          <button style={styles.boutonFermer} onClick={onFermer}>✕</button>
        </div>

        <div style={{ ...styles.badgeStatut, ...(estActive ? styles.badgeActive : styles.badgeResolue) }}>
          {estActive ? '⚠ Alerte active' : '✔ Alerte résolue'}
        </div>

        <div style={styles.grille}>
          <div style={styles.champ}>
            <p style={styles.label}>Paramètre concerné</p>
            <p style={styles.valeur}>{LABELS[capteur?.type] || capteur?.type || '—'}</p>
          </div>
          <div style={styles.champ}>
            <p style={styles.label}>Valeur mesurée</p>
            <p style={styles.valeur}>{alerte.mesure_id?.valeur} {capteur?.unite}</p>
          </div>
          <div style={styles.champ}>
            <p style={styles.label}>Seuil autorisé</p>
            <p style={styles.valeur}>
              {seuil ? `${seuil.valeur_min} — ${seuil.valeur_max} ${capteur?.unite ?? ''}` : 'Non disponible'}
            </p>
          </div>
          <div style={styles.champ}>
            <p style={styles.label}>Type d'alerte</p>
            <p style={styles.valeur}>{alerte.type_alerte}</p>
          </div>
          <div style={styles.champ}>
            <p style={styles.label}>Déclenchée le</p>
            <p style={styles.valeur}>{new Date(alerte.horodatage).toLocaleString('fr-FR')}</p>
          </div>
          <div style={styles.champ}>
            <p style={styles.label}>Résolue le</p>
            <p style={styles.valeur}>{alerte.dateResolution ? new Date(alerte.dateResolution).toLocaleString('fr-FR') : '—'}</p>
          </div>
        </div>

        <div style={styles.sectionVanne}>
          <p style={styles.labelSection}>État de la vanne</p>

          <div style={styles.ligneVanne}>
            <span style={{ ...styles.pointVanne, background: '#B91C1C' }} />
            <span style={styles.texteVanne}>
              {estActive
                ? 'Fermée — cette alerte est actuellement en cause.'
                : "Fermée pendant toute la durée de cette alerte (jusqu'à sa résolution)."}
            </span>
          </div>

          {!estActive && vanneActuelle && (
            <div style={styles.ligneVanne}>
              <span style={{ ...styles.pointVanne, background: vanneActuelle.etat === 'ouverte' ? '#15803D' : '#B91C1C' }} />
              <span style={styles.texteVanne}>
                Maintenant : <strong>{vanneActuelle.etat === 'ouverte' ? 'Ouverte' : 'Fermée'}</strong>
                {vanneActuelle.etat === 'fermee' && ' (à cause d\'une autre alerte active)'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  fond: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  panneau: { background: 'white', borderRadius: 14, padding: 26, width: 420, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' },
  entete: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  titre: { fontSize: 16, color: '#0F172A' },
  boutonFermer: { background: 'none', border: 'none', fontSize: 16, color: '#94A3B8', cursor: 'pointer', padding: 4 },
  badgeStatut: { display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, marginBottom: 18 },
  badgeActive: { background: '#FEF3C7', color: '#B45309' },
  badgeResolue: { background: '#DCFCE7', color: '#15803D' },
  grille: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 },
  champ: {},
  label: { fontSize: 10.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 },
  valeur: { fontSize: 13.5, fontWeight: 600, color: '#0F172A' },
  sectionVanne: { background: '#F8FAFC', borderRadius: 10, padding: 14, border: '1px solid #E2E8F0' },
  labelSection: { fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 },
  ligneVanne: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  pointVanne: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  texteVanne: { fontSize: 12.5, color: '#334155', lineHeight: 1.5 },
};
