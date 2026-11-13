const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Capteur = require('../models/capteur.model');
const Site = require('../models/site.model');
const { envoyerAlerteEmail } = require('./email.service');
const { emailsResponsablesSite } = require('./responsables.service');

/**
 * Détermine le niveau de dépassement d'une valeur par rapport au seuil :
 * - null            : dans la plage normale [valeur_min, valeur_max]
 * - 'avertissement' : hors plage normale mais dans les seuils critiques
 * - 'critique'      : au-delà d'un seuil critique. Si aucun seuil critique n'est
 *                     défini d'un côté, le seuil normal de ce côté en tient lieu.
 */
function niveauDepassement(valeur, seuil) {
  const critiqueMin = seuil.critique_min ?? seuil.valeur_min;
  const critiqueMax = seuil.critique_max ?? seuil.valeur_max;

  if (valeur < critiqueMin || valeur > critiqueMax) return 'critique';
  if (valeur < seuil.valeur_min || valeur > seuil.valeur_max) return 'avertissement';
  return null;
}

/**
 * Compare une mesure au seuil de son capteur.
 * - Si le capteur a été désactivé entre-temps (voir capteurs.controller.js), la
 *   mesure est tout de même enregistrée (le heartbeat continue d'exister), mais
 *   elle n'est plus jamais comparée aux seuils.
 * - Hors plage normale : crée une alerte active (une seule par capteur, pour
 *   éviter le spam à chaque cycle de mesure). L'email n'est envoyé que si le
 *   seuil CRITIQUE est franchi — y compris si une alerte « avertissement »
 *   déjà active s'aggrave en « critique » (escalade, un seul email).
 * - Revenue dans la plage normale : résout automatiquement toute alerte de
 *   seuil active de ce capteur — c'est ce qui permet à la vanne de se rouvrir
 *   automatiquement (voir vanne.controller.js).
 */
async function verifierSeuil(mesure) {
  const [seuil, capteur] = await Promise.all([
    Seuil.findOne({ capteur_id: mesure.capteur_id }),
    Capteur.findById(mesure.capteur_id),
  ]);
  if (!seuil || !capteur || !capteur.actif) return null;

  const niveau = niveauDepassement(mesure.valeur, seuil);

  if (!niveau) {
    await resoudreAlertesActives(mesure.capteur_id, 'seuil');
    return null;
  }

  const [dejaActive] = await alertesActivesDuCapteur(mesure.capteur_id, 'seuil');

  if (dejaActive) {
    // Escalade : l'alerte existante passe en critique, on notifie une seule fois.
    if (niveau === 'critique' && dejaActive.niveau !== 'critique') {
      dejaActive.niveau = 'critique';
      dejaActive.type_alerte = 'Seuil critique dépassé';
      dejaActive.mesure_id = mesure._id;
      dejaActive.emailEnvoye = true;
      await dejaActive.save();
      lancerNotification(capteur, mesure, seuil);
    }
    return null;
  }

  const alerte = await Alerte.create({
    mesure_id: mesure._id,
    capteur_id: capteur._id,
    site_id: capteur.site_id,
    categorie: 'seuil',
    niveau,
    type_alerte: niveau === 'critique' ? 'Seuil critique dépassé' : 'Valeur hors seuil',
    statut: 'active',
    emailEnvoye: niveau === 'critique',
  });

  if (niveau === 'critique') lancerNotification(capteur, mesure, seuil);

  return alerte;
}

// Best-effort : un échec d'envoi d'email ne doit jamais faire échouer la
// création de l'alerte elle-même, d'où le .catch() plutôt qu'un await direct.
function lancerNotification(capteur, mesure, seuil) {
  notifierParEmail(capteur, mesure, seuil).catch((err) => {
    console.error('✘ Échec de la notification par email :', err.message);
  });
}

async function alertesActivesDuCapteur(capteurId, categorie) {
  const filtre = { capteur_id: capteurId, statut: 'active' };
  if (categorie) filtre.categorie = categorie;
  return Alerte.find(filtre);
}

async function resoudreAlertesActives(capteurId, categorie) {
  const filtre = { capteur_id: capteurId, statut: 'active' };
  if (categorie) filtre.categorie = categorie;
  await Alerte.updateMany(filtre, { statut: 'resolue', dateResolution: new Date() });
}

// Envoie un email aux responsables du site concerné — silencieux s'il n'y en a aucun.
async function notifierParEmail(capteur, mesure, seuil) {
  const destinataires = await emailsResponsablesSite(capteur.site_id);
  if (destinataires.length === 0) return;

  const site = await Site.findById(capteur.site_id).select('nom');
  await envoyerAlerteEmail({
    destinataires,
    type: capteur.type,
    valeur: mesure.valeur,
    unite: capteur.unite,
    seuil,
    siteNom: site ? site.nom : 'Site inconnu',
  });
}

module.exports = { verifierSeuil, niveauDepassement, alertesActivesDuCapteur, resoudreAlertesActives };
