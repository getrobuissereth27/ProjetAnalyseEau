export default function BandeauVanne({ etat }) {
  if (!etat) return null;

  const ouverte = etat.etat === 'ouverte';

  return (
    <div style={{ ...styles.bandeau, ...(ouverte ? styles.ouverte : styles.fermee) }}>
      <div style={{ ...styles.pastille, background: ouverte ? '#15803D' : '#B91C1C' }}>
        <span style={styles.icone}>{ouverte ? '💧' : '⛔'}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ ...styles.titre, color: ouverte ? '#15803D' : '#B91C1C' }}>
          Vanne de distribution : {ouverte ? 'OUVERTE' : 'FERMÉE'}
        </p>
        <p style={styles.detail}>
          {ouverte
            ? 'Tous les paramètres sont dans les limites — distribution normale.'
            : `Fermeture automatique — ${etat.parametresHorsLimite.map((p) => `${p.type} (${p.valeur} ${p.unite})`).join(', ')} hors seuil.`}
        </p>
      </div>
      <div style={styles.led}>
        <span style={{ ...styles.pointLed, background: ouverte ? '#E2E8F0' : '#EF4444', boxShadow: ouverte ? 'none' : '0 0 8px #EF4444' }} />
        <span style={styles.legendeLed}>LED {ouverte ? 'éteinte' : 'allumée'}</span>
      </div>
    </div>
  );
}

const styles = {
  bandeau: { display: 'flex', alignItems: 'center', gap: 16, borderRadius: 14, padding: '16px 20px', marginBottom: 22, border: '1px solid' },
  ouverte: { background: '#F0FDF4', borderColor: '#BBF7D0' },
  fermee: { background: '#FEF2F2', borderColor: '#FECACA' },
  pastille: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icone: { fontSize: 20 },
  titre: { fontSize: 15, fontWeight: 800 },
  detail: { fontSize: 12.5, color: '#475569', marginTop: 2 },
  led: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingLeft: 16, borderLeft: '1px solid rgba(0,0,0,0.08)' },
  pointLed: { width: 14, height: 14, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)' },
  legendeLed: { fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap' },
};
