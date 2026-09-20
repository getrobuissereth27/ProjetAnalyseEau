const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const Destinataire = require('../models/destinataire.model');
const Site = require('../models/site.model');
const { envoyerAlerteEmail } = require('./email.service');

/**
 * Compare une mesure au seuil de son capteur.
 * - Si le capteur a été désactivé entre-temps (voir capteurs.controller.js), la
 *   mesure est tout de même enregistrée (le heartbeat continue d'exister), mais
 *   elle n'est plus jamais comparée aux seuils.
 * - Si la valeur est hors seuil : crée une alerte active (sauf s'il y en a déjà
 *   une active pour ce capteur, pour éviter le spam à chaque cycle de mesure).
 * - Si la valeur est revenue dans les limites : résout automatiquement toute
 *   alerte active de ce capteur — c'est ce qui permet à la vanne de se rouvrir
 *   automatiquement (voir vanne.controller.js).
 */
async function verifierSeuil(mesure) {
  const [seuil, capteur] = await Promise.all([
    Seuil.findOne({ capteur_id: mesure.capteur_id }),
    Capteur.findById(mesure.capteur_id),
  ]);
  if (!seuil || !capteur || !capteur.actif) return null;

  const horsSeuil = mesure.valeur < seuil.valeur_min || mesure.valeur > seuil.valeur_max;

  if (horsSeuil) {
    const dejaActive = await alerteActiveExiste(mesure.capteur_id);
    if (dejaActive) return null;

    const alerte = await Alerte.create({
      mesure_id: mesure._id,
      type_alerte: 'Valeur hors seuil',
      statut: 'active',
    });

    // Best-effort : un échec d'envoi d'email ne doit jamais faire échouer la
    // création de l'alerte elle-même, d'où le .catch() plutôt qu'un await direct.
    notifierParEmail(capteur, mesure, seuil).catch((err) => {
      console.error("✘ Échec de la notification par email :", err.message);
    });

    return alerte;
  }

  await resoudreAlertesActives(mesure.capteur_id);
  return null;
}

// Une alerte est liée à une mesure, elle-même liée à un capteur — cette fonction
// retrouve les alertes actives concernant un capteur donné, en remontant ce lien.
async function alertesActivesDuCapteur(capteurId) {
  const mesuresDuCapteur = await Mesure.find({ capteur_id: capteurId }).select('_id');
  const idsMesures = mesuresDuCapteur.map((m) => m._id);
  return Alerte.find({ mesure_id: { $in: idsMesures }, statut: 'active' });
}

async function alerteActiveExiste(capteurId) {
  const alertes = await alertesActivesDuCapteur(capteurId);
  return alertes.length > 0;
}

async function resoudreAlertesActives(capteurId) {
  const alertes = await alertesActivesDuCapteur(capteurId);
  if (alertes.length === 0) return;
  const ids = alertes.map((a) => a._id);
  await Alerte.updateMany({ _id: { $in: ids } }, { statut: 'resolue', dateResolution: new Date() });
}

// Envoie un email à tous les destinataires actifs du site concerné — silencieux
// s'il n'y en a aucun (voir la page "Destinataires des alertes par email").
async function notifierParEmail(capteur, mesure, seuil) {
  const destinataires = await Destinataire.find({ site_id: capteur.site_id, actif: true }).select('email');
  if (destinataires.length === 0) return;

  const site = await Site.findById(capteur.site_id).select('nom');
  await envoyerAlerteEmail({
    destinataires: destinataires.map((d) => d.email),
    type: capteur.type,
    valeur: mesure.valeur,
    unite: capteur.unite,
    seuil,
    siteNom: site ? site.nom : 'Site inconnu',
  });
}

module.exports = { verifierSeuil, alertesActivesDuCapteur };
