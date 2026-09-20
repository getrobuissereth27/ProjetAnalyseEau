const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');

// Un site n'est jamais référencé directement par Alerte : il faut remonter la
// chaîne capteur → mesure → alerte pour filtrer par site.
async function idsCapteursDuSite(siteId) {
  if (!siteId) return null; // pas de filtre
  const capteurs = await Capteur.find({ site_id: siteId }).select('_id');
  return capteurs.map((c) => c._id);
}

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

// DELETE /api/alertes/:id
exports.supprimerAlerte = async (req, res) => {
  try {
    const alerte = await Alerte.findByIdAndDelete(req.params.id);
    if (!alerte) return res.status(404).json({ erreur: 'Alerte introuvable' });
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/alertes   body: { ids: ["...", "..."] }
// Suppression en masse — utilisée par la sélection multiple côté interface (page Alertes).
exports.supprimerAlertes = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ erreur: 'Un tableau ids non vide est requis' });
    }
    const resultat = await Alerte.deleteMany({ _id: { $in: ids } });
    res.json({ supprimees: resultat.deletedCount });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
