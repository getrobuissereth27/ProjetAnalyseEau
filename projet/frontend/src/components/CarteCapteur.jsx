const LABELS = { pH: 'pH', turbidite: 'Turbidité', temperature: 'Température', tds: 'Conductivité' };
const STATUT_INFO = {
  fonctionne: { libelle: 'En ligne', couleur: '#15803D', fond: '#DCFCE7' },
  defectueux: { libelle: 'Ne répond plus', couleur: '#B91C1C', fond: '#FEE2E2' },
  inconnu: { libelle: 'Aucune donnée', couleur: '#B45309', fond: '#FEF3C7' },
};

function ilYA(horodatage) {
  if (!horodatage) return null;
  const secondes = Math.floor((Date.now() - new Date(horodatage).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

// Plage lisible : « 6.5 – 8.5 », « ≤ 10 », « ≥ 6 »
function formaterPlage(min, max) {
  const aMin = min !== null && min !== undefined;
  const aMax = max !== null && max !== undefined;
  if (aMin && aMax) return `${min} – ${max}`;
  if (aMax) return `≤ ${max}`;
  if (aMin) return `≥ ${min}`;
  return null;
}

// niveauAlerte : null | 'avertissement' | 'critique' (alerte de seuil active)
export default function CarteCapteur({ type, valeur, unite, niveauAlerte, statut, horodatage, seuil }) {
  const infoStatut = STATUT_INFO[statut];
  // On ne peut affirmer "Normal" ou "Hors seuil" que si le capteur répond
  // actuellement (heartbeat "fonctionne") — sinon la valeur affichée n'est
  // qu'un dernier relevé connu, potentiellement périmé depuis longtemps.
  const estFiable = statut === 'fonctionne';
  const estCritique = niveauAlerte === 'critique';
  const couleurBarre = !estFiable ? '#94A3B8' : (estCritique ? '#B91C1C' : (niveauAlerte ? '#B45309' : '#15803D'));

  const plageNormale = seuil ? formaterPlage(seuil.valeur_min, seuil.valeur_max) : null;
  const plageCritique = seuil ? formaterPlage(seuil.critique_min, seuil.critique_max) : null;

  return (
    <div className="carte">
      <div className="bar" style={{ background: couleurBarre }} />
      <p className="label">{LABELS[type] || type}</p>
      <p className="value" style={!estFiable ? { opacity: 0.5 } : undefined}>
        {valeur ?? '—'} <span className="unit">{unite}</span>
      </p>

      {estFiable ? (
        estCritique ? (
          <span style={{ ...styles.puceStatut, color: '#B91C1C', background: '#FEE2E2' }}>Seuil critique</span>
        ) : (
          <span className={`badge ${niveauAlerte ? 'alerte' : 'ok'}`}>
            <span className="badge-dot" />
            {niveauAlerte ? 'Hors seuil' : 'Normal'}
          </span>
        )
      ) : (
        infoStatut && (
          <span style={{ ...styles.puceStatut, color: infoStatut.couleur, background: infoStatut.fond }}>
            {infoStatut.libelle}
          </span>
        )
      )}

      {!estFiable && horodatage && (
        <p style={styles.petitTexte}>Dernière donnée reçue {ilYA(horodatage)}</p>
      )}

      <div style={styles.seuils}>
        {plageNormale ? (
          <>
            <p style={styles.petitTexte}>Seuil : {plageNormale} {unite}</p>
            {plageCritique && <p style={styles.petitTexte}>Critique : {plageCritique} {unite}</p>}
          </>
        ) : (
          <p style={styles.petitTexte}>Aucun seuil configuré</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  puceStatut: { display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999 },
  petitTexte: { fontSize: 10.5, color: '#94A3B8', marginTop: 4, lineHeight: 1.35 },
  seuils: { marginTop: 6 },
};
