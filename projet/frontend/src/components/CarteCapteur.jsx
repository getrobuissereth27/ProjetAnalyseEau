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

export default function CarteCapteur({ type, valeur, unite, enAlerte, statut, horodatage }) {
  const infoStatut = STATUT_INFO[statut];
  // On ne peut affirmer "Normal" ou "Hors seuil" que si le capteur répond
  // actuellement (heartbeat "fonctionne") — sinon la valeur affichée n'est
  // qu'un dernier relevé connu, potentiellement périmé depuis longtemps.
  const estFiable = statut === 'fonctionne';

  return (
    <div className="carte">
      <div className="bar" style={{ background: !estFiable ? '#94A3B8' : (enAlerte ? '#B45309' : '#15803D') }} />
      <p className="label">{LABELS[type] || type}</p>
      <p className="value" style={!estFiable ? { opacity: 0.5 } : undefined}>
        {valeur ?? '—'} <span className="unit">{unite}</span>
      </p>

      {estFiable ? (
        <span className={`badge ${enAlerte ? 'alerte' : 'ok'}`}>
          <span className="badge-dot" />
          {enAlerte ? 'Hors seuil' : 'Normal'}
        </span>
      ) : (
        infoStatut && (
          <span style={{ ...styles.puceStatut, color: infoStatut.couleur, background: infoStatut.fond }}>
            {infoStatut.libelle}
          </span>
        )
      )}

      {!estFiable && horodatage && (
        <p style={styles.derniereDonnee}>Dernière donnée reçue {ilYA(horodatage)}</p>
      )}
    </div>
  );
}

const styles = {
  puceStatut: { display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999 },
  derniereDonnee: { fontSize: 10.5, color: '#94A3B8', marginTop: 6 },
};
