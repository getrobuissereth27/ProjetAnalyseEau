const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const { verifierSeuil } = require('../services/analyse.service');

// POST /api/mesures
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

    await verifierSeuil(mesure);

    res.status(201).json(mesure);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/mesures/dernieres?site=<id>
exports.dernieresMesures = async (req, res) => {
  try {
    const filtre = req.query.site ? { site_id: req.query.site } : {};
    // Un capteur désactivé n'apparaît plus sur le tableau de bord (voir capteurs.controller.js)
    const capteurs = await Capteur.find({ ...filtre, actif: true });
    const resultats = await Promise.all(
      capteurs.map(async (capteur) => {
        const derniere = await Mesure.findOne({ capteur_id: capteur._id }).sort({ horodatage: -1 });
        return {
          capteur_id: capteur._id,
          type: capteur.type,
          unite: capteur.unite,
          statut: capteur.statut,
          valeur: derniere ? derniere.valeur : null,
          horodatage: derniere ? derniere.horodatage : null,
        };
      })
    );
    res.json(resultats);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/mesures/historique?capteur=<id>&jours=7
exports.historique = async (req, res) => {
  try {
    const { capteur, jours = 7 } = req.query;
    if (!capteur) return res.status(400).json({ erreur: 'paramètre capteur requis' });

    const depuis = new Date(Date.now() - Number(jours) * 24 * 60 * 60 * 1000);
    const mesures = await Mesure.find({ capteur_id: capteur, horodatage: { $gte: depuis } })
      .sort({ horodatage: 1 });

    res.json(mesures);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/mesures/:id
exports.supprimerMesure = async (req, res) => {
  try {
    const mesure = await Mesure.findByIdAndDelete(req.params.id);
    if (!mesure) return res.status(404).json({ erreur: 'Mesure introuvable' });
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/mesures   body: { ids: ["...", "..."] }
// Suppression en masse — utilisée par la sélection multiple côté interface (page Historique).
exports.supprimerMesures = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ erreur: 'Un tableau ids non vide est requis' });
    }
    const resultat = await Mesure.deleteMany({ _id: { $in: ids } });
    res.json({ supprimees: resultat.deletedCount });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
