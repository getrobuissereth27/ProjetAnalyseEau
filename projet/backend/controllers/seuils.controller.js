const Seuil = require('../models/seuil.model');
const Capteur = require('../models/capteur.model');

// GET /api/seuils?site=<id>
// Part de la liste des CAPTEURS (pas des seuils), pour qu'un capteur tout juste
// créé apparaisse aussi dans le tableau — même avant qu'un seuil lui soit défini.
exports.listerSeuils = async (req, res) => {
  try {
    const filtreCapteur = req.query.site ? { site_id: req.query.site } : {};
    const capteurs = await Capteur.find(filtreCapteur);

    const resultats = await Promise.all(
      capteurs.map(async (capteur) => {
        const seuil = await Seuil.findOne({ capteur_id: capteur._id });
        return {
          _id: seuil ? seuil._id : null,
          capteur_id: capteur,
          valeur_min: seuil ? seuil.valeur_min : null,
          valeur_max: seuil ? seuil.valeur_max : null,
        };
      })
    );

    res.json(resultats);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PUT /api/seuils/:capteurId
exports.modifierSeuil = async (req, res) => {
  try {
    const { valeur_min, valeur_max } = req.body;
    if (valeur_min === undefined || valeur_max === undefined) {
      return res.status(400).json({ erreur: 'valeur_min et valeur_max sont requis' });
    }
    const seuil = await Seuil.findOneAndUpdate(
      { capteur_id: req.params.capteurId },
      { valeur_min, valeur_max },
      { new: true, upsert: true }
    );
    res.json(seuil);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
