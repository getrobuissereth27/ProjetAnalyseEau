const Destinataire = require('../models/destinataire.model');
const Utilisateur = require('../models/utilisateur.model');

// Adresses à prévenir pour un site : les destinataires email actifs configurés
// pour ce site + les utilisateurs (administrateurs et responsables) qui y sont
// rattachés. Les doublons sont supprimés.
async function emailsResponsablesSite(siteId) {
  // $ne: false plutôt que true : les destinataires créés avant l'ajout du champ
  // "actif" ne l'ont pas en base, et doivent être considérés actifs (défaut du schéma).
  const [destinataires, utilisateurs] = await Promise.all([
    Destinataire.find({ site_id: siteId, actif: { $ne: false } }).select('email'),
    Utilisateur.find({ sites: siteId }).select('email'),
  ]);

  const emails = [...destinataires, ...utilisateurs]
    .map((d) => d.email)
    .filter(Boolean)
    .map((e) => e.toLowerCase());
  return [...new Set(emails)];
}

module.exports = { emailsResponsablesSite };
