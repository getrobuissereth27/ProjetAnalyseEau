const LABELS = { pH: 'pH', turbidite: 'Turbidité', temperature: 'Température', tds: 'Conductivité' };

export default function CarteCapteur({ type, valeur, unite, enAlerte }) {
  return (
    <div className="carte">
      <div className="bar" style={{ background: enAlerte ? '#B45309' : '#15803D' }} />
      <p className="label">{LABELS[type] || type}</p>
      <p className="value">
        {valeur ?? '—'} <span className="unit">{unite}</span>
      </p>
      <span className={`badge ${enAlerte ? 'alerte' : 'ok'}`}>
        <span className="badge-dot" />
        {enAlerte ? 'Hors seuil' : 'Normal'}
      </span>
    </div>
  );
}
