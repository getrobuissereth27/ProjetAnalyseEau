// Hiérarchie des rôles (identique au backend, voir middleware/auth.middleware.js) :
// un rôle supérieur a tous les droits des rôles inférieurs.
const RANG = { communautaire: 0, administrateur: 1, superadmin: 2 };

export const LIBELLES_ROLE = {
  superadmin: 'Super administrateur',
  administrateur: 'Administrateur',
  communautaire: 'Responsable CAEPA',
};

export function aLeRole(utilisateur, roleRequis) {
  return (RANG[utilisateur?.role] ?? -1) >= RANG[roleRequis];
}

export const estAdmin = (utilisateur) => aLeRole(utilisateur, 'administrateur');
export const estSuperAdmin = (utilisateur) => utilisateur?.role === 'superadmin';

// Une alerte récente porte directement son capteur ; une ancienne ne le porte
// qu'au travers de sa mesure.
export function capteurDeLAlerte(alerte) {
  if (alerte?.capteur_id && typeof alerte.capteur_id === 'object') return alerte.capteur_id;
  return alerte?.mesure_id?.capteur_id || null;
}
