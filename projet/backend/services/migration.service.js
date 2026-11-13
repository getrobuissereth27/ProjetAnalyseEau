const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const Utilisateur = require('../models/utilisateur.model');

/**
 * Mises à niveau idempotentes des données existantes, exécutées au démarrage :
 * 1. Les anciennes alertes n'étaient liées qu'à une mesure : on y ajoute
 *    capteur_id / site_id / categorie, utilisés désormais pour filtrer.
 * 2. S'il n'existe encore aucun superadmin, le plus ancien administrateur est
 *    promu, pour que personne ne perde l'accès à la gestion des sites.
 */
async function migrerDonnees() {
  const anciennes = await Alerte.find({ capteur_id: null, mesure_id: { $ne: null } }).select('mesure_id');
  for (const alerte of anciennes) {
    const mesure = await Mesure.findById(alerte.mesure_id).select('capteur_id');
    const capteur = mesure ? await Capteur.findById(mesure.capteur_id).select('site_id') : null;
    if (!capteur) continue;
    await Alerte.updateOne(
      { _id: alerte._id },
      // Avant les seuils critiques, toute alerte déclenchait l'email.
      { capteur_id: capteur._id, site_id: capteur.site_id, categorie: 'seuil', niveau: 'critique', emailEnvoye: true }
    );
  }
  if (anciennes.length) console.log(`✔ Migration : ${anciennes.length} alerte(s) rattachée(s) à leur capteur/site`);

  const superadminExiste = await Utilisateur.exists({ role: 'superadmin' });
  if (!superadminExiste) {
    const premierAdmin = await Utilisateur.findOne({ role: 'administrateur' }).sort({ createdAt: 1 });
    if (premierAdmin) {
      premierAdmin.role = 'superadmin';
      await premierAdmin.save();
      console.log(`✔ Migration : ${premierAdmin.email} promu superadmin (aucun superadmin n'existait)`);
    }
  }
}

module.exports = { migrerDonnees };
