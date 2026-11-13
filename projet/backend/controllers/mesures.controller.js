const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const Seuil = require('../models/seuil.model');
const { verifierSeuil } = require('../services/analyse.service');
const { resoudreAlertesDefaillance } = require('../services/surveillance.service');
const { aAccesSite, filtreSites, estSuperAdmin } = require('../middleware/auth.middleware');

// Identifiants des capteurs des sites accessibles à l'utilisateur (null = pas de restriction).
async function idsCapteursAccessibles(utilisateur) {
  if (estSuperAdmin(utilisateur)) return null;
  const capteurs = await Capteur.find({ site_id: { $in: utilisateur.sites } }).select('_id');
  return capteurs.map((c) => c._id);
}

// POST /api/measurements
// Reste public : c'est le Raspberry Pi qui envoie les mesures.
exports.creerMesure = async (req, res) => {
  try {
    const { capteur_id, valeur } = req.body;
    if (!capteur_id || valeur === undefined) {
      return res.status(400).json({ erreur: 'capteur_id et valeur sont requis' });
    }

    const mesure = await Mesure.create({ capteur_id, valeur });

    // Heartbeat : toute mesure reçue, quelle que soit sa valeur, prouve que le
    // capteur est physiquement vivant — voir le virtual "statut" sur le modèle.
    await Capteur.findByIdAndUpdate(capteur_id, { dernierBattement: new Date() });
    await resoudreAlertesDefaillance(capteur_id);

    await verifierSeuil(mesure);

    res.status(201).json(mesure);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/measurements/latest?site=<id>
// Renvoie aussi le seuil configuré de chaque capteur, affiché en petit sur sa carte.
exports.dernieresMesures = async (req, res) => {
  try {
    const filtre = filtreSites(req.utilisateur, req.query.site);
    if (!filtre) return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });

    // Un capteur désactivé n'apparaît plus sur le tableau de bord (voir capteurs.controller.js)
    const capteurs = await Capteur.find({ ...filtre, actif: true });
    const seuils = await Seuil.find({ capteur_id: { $in: capteurs.map((c) => c._id) } });
    const seuilParCapteur = new Map(seuils.map((s) => [s.capteur_id.toString(), s]));

    const resultats = await Promise.all(
      capteurs.map(async (capteur) => {
        const derniere = await Mesure.findOne({ capteur_id: capteur._id }).sort({ horodatage: -1 });
        const seuil = seuilParCapteur.get(capteur._id.toString());
        return {
          capteur_id: capteur._id,
          type: capteur.type,
          unite: capteur.unite,
          statut: capteur.statut,
          delaiDefaillanceSecondes: capteur.delaiDefaillanceSecondes,
          valeur: derniere ? derniere.valeur : null,
          horodatage: derniere ? derniere.horodatage : null,
          seuil: seuil
            ? {
              valeur_min: seuil.valeur_min,
              valeur_max: seuil.valeur_max,
              critique_min: seuil.critique_min,
              critique_max: seuil.critique_max,
            }
            : null,
        };
      })
    );
    res.json(resultats);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/measurements/history?capteur=<id>&jours=7
// GET /api/measurements/history?capteur=<id>&debut=<ISO>&fin=<ISO>   (plage libre)
exports.historique = async (req, res) => {
  try {
    const { capteur, jours = 7, debut, fin } = req.query;
    if (!capteur) return res.status(400).json({ erreur: 'paramètre capteur requis' });

    let plage;
    if (debut || fin) {
      const dateDebut = debut ? new Date(debut) : new Date(0);
      const dateFin = fin ? new Date(fin) : new Date();
      if (Number.isNaN(dateDebut.getTime()) || Number.isNaN(dateFin.getTime())) {
        return res.status(400).json({ erreur: 'Dates de début / fin invalides' });
      }
      if (dateDebut > dateFin) {
        return res.status(400).json({ erreur: 'La date de début doit précéder la date de fin' });
      }
      plage = { $gte: dateDebut, $lte: dateFin };
    } else {
      plage = { $gte: new Date(Date.now() - Number(jours) * 24 * 60 * 60 * 1000) };
    }

    const doc = await Capteur.findById(capteur).select('site_id');
    if (!doc) return res.status(404).json({ erreur: 'Capteur introuvable' });
    if (!aAccesSite(req.utilisateur, doc.site_id)) {
      return res.status(403).json({ erreur: "Tu n'as pas accès au site de ce capteur" });
    }

    const mesures = await Mesure.find({ capteur_id: capteur, horodatage: plage })
      .sort({ horodatage: 1 });

    res.json(mesures);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/measurements/:id
exports.supprimerMesure = async (req, res) => {
  try {
    const idsCapteurs = await idsCapteursAccessibles(req.utilisateur);
    const filtre = { _id: req.params.id };
    if (idsCapteurs) filtre.capteur_id = { $in: idsCapteurs };

    const mesure = await Mesure.findOneAndDelete(filtre);
    if (!mesure) return res.status(404).json({ erreur: 'Mesure introuvable' });
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/measurements   body: { ids: ["...", "..."] }
// Suppression en masse — utilisée par la sélection multiple côté interface (page Historique).
// Seules les mesures des sites accessibles sont supprimées.
exports.supprimerMesures = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ erreur: 'Un tableau ids non vide est requis' });
    }
    const idsCapteurs = await idsCapteursAccessibles(req.utilisateur);
    const filtre = { _id: { $in: ids } };
    if (idsCapteurs) filtre.capteur_id = { $in: idsCapteurs };

    const resultat = await Mesure.deleteMany(filtre);
    res.json({ supprimees: resultat.deletedCount });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
