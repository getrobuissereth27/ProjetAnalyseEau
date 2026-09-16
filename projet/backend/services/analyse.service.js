const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const Site = require('../models/site.model');
const Destinataire = require('../models/destinataire.model');
const { envoyerAlerteEmail } = require('./email.service');

/**
 * Compare une mesure au seuil de son capteur.
 * - Si la valeur est hors seuil : crée une alerte active (sauf s'il y en a déjà
 *   une active pour ce capteur, pour éviter le spam à chaque cycle de mesure),
 *   puis notifie par email les destinataires configurés pour ce site.
 * - Si la valeur est revenue dans les limites : résout automatiquement toute
 *   alerte active de ce capteur — c'est ce qui permet à la vanne de se rouvrir
 *   automatiquement (voir vanne.controller.js).
 */
async function verifierSeuil(mesure) {
  const seuil = await Seuil.findOne({ capteur_id: mesure.capteur_id });
  if (!seuil) return null;

  const horsSeuil = mesure.valeur < seuil.valeur_min || mesure.valeur > seuil.valeur_max;

  if (horsSeuil) {
    const dejaActive = await alerteActiveExiste(mesure.capteur_id);
    if (dejaActive) return null;

    const alerte = await Alerte.create({
      mesure_id: mesure._id,
      type_alerte: 'Valeur hors seuil',
      statut: 'active',
    });

    // La notification ne doit jamais faire échouer l'enregistrement de la mesure
    // elle-même : toute erreur d'envoi est capturée et journalisée séparément.
    notifierParEmail(mesure, seuil, alerte).catch((err) => {
      console.error('✘ Erreur lors de la notification email :', err.message);
    });

    return alerte;
  }

  await resoudreAlertesActives(mesure.capteur_id);
  return null;
}

async function notifierParEmail(mesure, seuil, alerte) {
  const capteur = await Capteur.findById(mesure.capteur_id);
  if (!capteur) return;

  const [site, destinatairesDocs] = await Promise.all([
    Site.findById(capteur.site_id),
    Destinataire.find({ site_id: capteur.site_id }),
  ]);
  if (!site) return;

  await envoyerAlerteEmail({
    site,
    capteur,
    mesure,
    seuil,
    typeAlerte: alerte.type_alerte,
    horodatage: alerte.horodatage,
    destinataires: destinatairesDocs.map((d) => d.email),
  });
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

module.exports = { verifierSeuil, alertesActivesDuCapteur };
