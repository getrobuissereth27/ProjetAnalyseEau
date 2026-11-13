const Alerte = require('../models/alerte.model');
const { filtreSites } = require('../middleware/auth.middleware');

// GET /api/alerts?statut=active&categorie=seuil&page=1&limite=15&site=<id>
// Sans ?site, renvoie les alertes de tous les sites accessibles à l'utilisateur.
exports.listerAlertes = async (req, res) => {
  try {
    const filtreSite = filtreSites(req.utilisateur, req.query.site);
    if (!filtreSite) return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });

    const filtre = { ...filtreSite };
    if (req.query.statut) filtre.statut = req.query.statut;
    if (req.query.categorie) filtre.categorie = req.query.categorie;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 15));

    const [alertes, total] = await Promise.all([
      Alerte.find(filtre)
        .sort({ horodatage: -1 })
        .skip((page - 1) * limite)
        .limit(limite)
        .populate('capteur_id')
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

// DELETE /api/alerts/:id
exports.supprimerAlerte = async (req, res) => {
  try {
    const alerte = await Alerte.findOneAndDelete({ _id: req.params.id, ...filtreSites(req.utilisateur) });
    if (!alerte) return res.status(404).json({ erreur: 'Alerte introuvable' });
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/alerts
//   body: { ids: ["...", "..."] }                       → ces alertes-là
//   body: { tout: true, site: "<id>", statut?: "..." }  → toutes les alertes du site
//                                                         correspondant au filtre
// Suppression en masse — utilisée par la sélection multiple côté interface (page Alertes).
// Le mode « tout » évite d'envoyer des milliers d'identifiants dans une seule requête.
// Seules les alertes des sites accessibles sont supprimées.
exports.supprimerAlertes = async (req, res) => {
  try {
    const { ids, tout, site, statut, categorie } = req.body;

    if (tout === true) {
      if (!site) return res.status(400).json({ erreur: 'Le site est requis pour tout supprimer' });
      const filtre = filtreSites(req.utilisateur, site);
      if (!filtre) return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });
      if (statut) filtre.statut = statut;
      if (categorie) filtre.categorie = categorie;
      const resultat = await Alerte.deleteMany(filtre);
      return res.json({ supprimees: resultat.deletedCount });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ erreur: 'Un tableau ids non vide est requis' });
    }
    const resultat = await Alerte.deleteMany({ _id: { $in: ids }, ...filtreSites(req.utilisateur) });
    res.json({ supprimees: resultat.deletedCount });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
