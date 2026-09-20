const BROCHES_ANALOGIQUES = Array.from({ length: 16 }, (_, i) => `A${i}`);

export default function PortsArduino({ seuils }) {
  const brocheOccupeePar = {};
  const digitalesUtilisees = [];

  seuils.forEach((s) => {
    const broche = s.capteur_id?.broche;
    if (!broche) return;
    if (BROCHES_ANALOGIQUES.includes(broche)) {
      brocheOccupeePar[broche] = s.capteur_id.type;
    } else {
      digitalesUtilisees.push({ broche, type: s.capteur_id.type });
    }
  });

  const nbUtilisees = Object.keys(brocheOccupeePar).length;

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-header">
        <h2>Broches Arduino Mega</h2>
        <span className="tag">{nbUtilisees} / 16 analogiques utilisées</span>
      </div>

      <div style={styles.grille}>
        {BROCHES_ANALOGIQUES.map((broche) => {
          const occupePar = brocheOccupeePar[broche];
          return (
            <div key={broche} style={{ ...styles.puce, ...(occupePar ? styles.puceOccupee : styles.puceLibre) }}>
              <span style={styles.brocheNom}>{broche}</span>
              <span style={styles.brocheStatut}>{occupePar ? occupePar : 'libre'}</span>
            </div>
          );
        })}
      </div>

      {digitalesUtilisees.length > 0 && (
        <div style={styles.sectionDigitales}>
          <p style={styles.labelDigitales}>Broches numériques (1-Wire / GPIO)</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {digitalesUtilisees.map((d) => (
              <span key={d.broche} style={{ ...styles.puce, ...styles.puceOccupee, width: 'auto', padding: '6px 12px' }}>
                {d.broche} · {d.type}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={styles.note}>
        16 broches analogiques disponibles sur l'Arduino Mega — aucun convertisseur ADC externe requis.
        Les broches numériques (D0-D53) sont réservées aux capteurs 1-Wire comme le DS18B20.
      </p>
    </div>
  );
}

const styles = {
  grille: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, marginBottom: 16 },
  puce: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px', borderRadius: 8, border: '1px solid' },
  puceLibre: { background: '#F8FAFC', borderColor: '#E2E8F0', color: '#94A3B8' },
  puceOccupee: { background: '#DCFCE7', borderColor: '#BBF7D0', color: '#15803D' },
  brocheNom: { fontSize: 12.5, fontWeight: 700 },
  brocheStatut: { fontSize: 9.5, textTransform: 'capitalize', textAlign: 'center' },
  sectionDigitales: { marginBottom: 14 },
  labelDigitales: { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 },
  note: { fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5, margin: 0 },
};
