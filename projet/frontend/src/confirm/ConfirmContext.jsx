import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Remplace window.confirm() par une fenêtre modale intégrée à l'application.
// Usage :
//   const confirmer = useConfirmer();
//   if (!(await confirmer({ titre: 'Supprimer ?', message: '...', texteConfirmer: 'Supprimer' }))) return;
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolveRef = useRef(null);
  const boutonAnnulerRef = useRef(null);

  const confirmer = useCallback((opts) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setOptions(opts || {});
  }), []);

  const fermer = useCallback((resultat) => {
    if (resolveRef.current) resolveRef.current(resultat);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  // Échap = annuler ; le focus part sur "Annuler" (choix le plus sûr par défaut)
  useEffect(() => {
    if (!options) return undefined;
    boutonAnnulerRef.current?.focus();
    const surTouche = (e) => { if (e.key === 'Escape') fermer(false); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [options, fermer]);

  const danger = options?.danger !== false;

  return (
    <ConfirmContext.Provider value={confirmer}>
      {children}
      {options && (
        <div style={styles.fond} onClick={() => fermer(false)} role="presentation">
          <div
            style={styles.panneau}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-titre"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ ...styles.icone, background: danger ? '#FEE2E2' : '#CCFBF1', color: danger ? '#B91C1C' : '#0F766E' }}>
              {danger ? '!' : '?'}
            </div>
            <h3 id="confirm-titre" style={styles.titre}>{options.titre || 'Confirmer cette action ?'}</h3>
            {options.message && <p style={styles.message}>{options.message}</p>}
            <div style={styles.actions}>
              <button ref={boutonAnnulerRef} style={styles.boutonAnnuler} onClick={() => fermer(false)}>
                {options.texteAnnuler || 'Annuler'}
              </button>
              <button
                style={{ ...styles.boutonConfirmer, background: danger ? '#B91C1C' : '#0F766E' }}
                onClick={() => fermer(true)}
              >
                {options.texteConfirmer || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirmer() {
  const confirmer = useContext(ConfirmContext);
  if (!confirmer) throw new Error('useConfirmer doit être utilisé dans <ConfirmProvider>.');
  return confirmer;
}

const styles = {
  fond: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 },
  panneau: { background: 'white', borderRadius: 14, padding: 26, width: 400, maxWidth: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' },
  icone: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 700 },
  titre: { fontSize: 17, color: '#0F172A', marginBottom: 8 },
  message: { fontSize: 13.5, color: '#475569', lineHeight: 1.55, marginBottom: 22, whiteSpace: 'pre-line' },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 },
  boutonAnnuler: { padding: '10px 20px', borderRadius: 9, border: '1px solid #CBD5E1', background: 'white', color: '#334155', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' },
  boutonConfirmer: { padding: '10px 20px', borderRadius: 9, border: 'none', color: 'white', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
};
