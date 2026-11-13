const Capteur = require('../models/capteur.model');
const Alerte = require('../models/alerte.model');
const Site = require('../models/site.model');
const { envoyerAlerteCapteurDefaillant } = require('./email.service');
const { emailsResponsablesSite } = require('./responsables.service');

/**
 * Parcourt les capteurs actifs et déclare défectueux ceux qui n'ont envoyé
 * aucune mesure depuis plus de leur délai de défaillance (configuré par
 * l'administrateur, voir Capteur.delaiDefaillanceSecondes).
 * Pour chaque nouveau capteur défaillant : une alerte « capteur_defaillant »
 * est créée (une seule tant qu'elle reste active) et les responsables du site
 * sont prévenus par email.
 *
 * Un capteur qui n'a encore jamais envoyé de mesure (statut « inconnu ») n'est
 * pas concerné : il vient sans doute d'être créé et n'est pas encore branché.
 */
async function verifierCapteursDefaillants(maintenant = new Date()) {
  const capteurs = await Capteur.find({ actif: true, dernierBattement: { $ne: null } });
  const nouvellesAlertes = [];

  for (const capteur of capteurs) {
    const ecouleMs = maintenant.getTime() - new Date(capteur.dernierBattement).getTime();
    if (ecouleMs <= capteur.delaiDefaillanceMs()) continue;

    const dejaActive = await Alerte.exists({
      capteur_id: capteur._id, categorie: 'capteur_defaillant', statut: 'active',
    });
    if (dejaActive) continue;

    const alerte = await Alerte.create({
      capteur_id: capteur._id,
      site_id: capteur.site_id,
      categorie: 'capteur_defaillant',
      niveau: 'critique',
      type_alerte: 'Capteur ne répond plus',
      statut: 'active',
      emailEnvoye: true,
    });
    nouvellesAlertes.push(alerte);

    notifierResponsables(capteur).catch((err) => {
      console.error('✘ Échec de la notification de capteur défaillant :', err.message);
    });
  }

  return nouvellesAlertes;
}

// Appelé dès qu'un capteur renvoie une mesure, ou qu'il est désactivé :
// son alerte de défaillance n'a plus lieu d'être.
async function resoudreAlertesDefaillance(capteurId) {
  await Alerte.updateMany(
    { capteur_id: capteurId, categorie: 'capteur_defaillant', statut: 'active' },
    { statut: 'resolue', dateResolution: new Date() }
  );
}

async function notifierResponsables(capteur) {
  const destinataires = await emailsResponsablesSite(capteur.site_id);
  if (destinataires.length === 0) return;

  const site = await Site.findById(capteur.site_id).select('nom');
  await envoyerAlerteCapteurDefaillant({
    destinataires,
    type: capteur.type,
    modele: capteur.modele,
    siteNom: site ? site.nom : 'Site inconnu',
    dernierBattement: capteur.dernierBattement,
    delaiSecondes: capteur.delaiDefaillanceSecondes,
  });
}

// Lance la vérification périodique (toutes les 15 s par défaut).
function demarrerSurveillance(intervalleMs = Number(process.env.SURVEILLANCE_INTERVALLE_MS) || 15000) {
  const minuteur = setInterval(() => {
    verifierCapteursDefaillants().catch((err) => {
      console.error('✘ Surveillance des capteurs :', err.message);
    });
  }, intervalleMs);
  minuteur.unref();
  console.log(`✔ Surveillance des capteurs active (vérification toutes les ${Math.round(intervalleMs / 1000)} s)`);
  return minuteur;
}

module.exports = { verifierCapteursDefaillants, resoudreAlertesDefaillance, demarrerSurveillance };
