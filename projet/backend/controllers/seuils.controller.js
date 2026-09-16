const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');

// Un site n'est jamais référencé directement par Seuil/Alerte : il faut
// remonter la chaîne capteur → mesure → alerte pour filtrer par site.
async function idsCapteursDuSite(siteId) {
  if (!siteId) return null; // pas de filtre
  const capteurs = await Capteur.find({ site_id: siteId }).select('_id');
  return capteurs.map((c) => c._id);
}

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

// GET /api/alertes?statut=active&page=1&limite=15&site=<id>
exports.listerAlertes = async (req, res) => {
  try {
    const filtre = req.query.statut ? { statut: req.query.statut } : {};

    if (req.query.site) {
      const idsCapteurs = await idsCapteursDuSite(req.query.site);
      const mesuresDuSite = await Mesure.find({ capteur_id: { $in: idsCapteurs } }).select('_id');
      filtre.mesure_id = { $in: mesuresDuSite.map((m) => m._id) };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 15));

    const [alertes, total] = await Promise.all([
      Alerte.find(filtre)
        .sort({ horodatage: -1 })
        .skip((page - 1) * limite)
        .limit(limite)
        .populate({ path: 'mesure_id', populate: { path: 'capteur_id' } }),
      Alerte.countDocuments(filtre),
    ]);

    res.json({
      resultats: alertes,
      total,
      page,
      limite,
      totalPages: Math.max(1, Math.ceil(total / limite)),
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
