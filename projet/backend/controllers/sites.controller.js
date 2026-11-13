const Site = require('../models/site.model');
const Utilisateur = require('../models/utilisateur.model');
const Capteur = require('../models/capteur.model');
const { estSuperAdmin } = require('../middleware/auth.middleware');

// GET /api/sites
// Le superadmin voit tous les sites ; les autres uniquement ceux qui leur sont attribués.
exports.listerSites = async (req, res) => {
  try {
    const filtre = estSuperAdmin(req.utilisateur) ? {} : { _id: { $in: req.utilisateur.sites } };
    const sites = await Site.find(filtre).sort({ createdAt: 1 });
    res.json(sites);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/sites  (superadmin uniquement, voir routes/sites.routes.js)
exports.creerSite = async (req, res) => {
  try {
    const { nom, localisation } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ erreur: 'Le nom du site est requis' });
    }
    const site = await Site.create({ nom: nom.trim(), localisation: localisation || '' });
    res.status(201).json(site);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/sites/:id   body: { nom?, localisation? }   (superadmin uniquement)
exports.modifierSite = async (req, res) => {
  try {
    const { nom, localisation } = req.body;
    const maj = {};
    if (nom !== undefined) {
      if (!nom.trim()) return res.status(400).json({ erreur: 'Le nom du site est requis' });
      maj.nom = nom.trim();
    }
    if (localisation !== undefined) maj.localisation = localisation;

    const site = await Site.findByIdAndUpdate(req.params.id, maj, { new: true });
    if (!site) return res.status(404).json({ erreur: 'Site introuvable' });
    res.json(site);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/sites/:id   (superadmin uniquement)
// Refusé tant que des capteurs y sont rattachés, pour ne jamais perdre d'historique par erreur.
exports.supprimerSite = async (req, res) => {
  try {
    const nbCapteurs = await Capteur.countDocuments({ site_id: req.params.id });
    if (nbCapteurs > 0) {
      return res.status(409).json({ erreur: `Ce site a encore ${nbCapteurs} capteur(s) : supprime-les d'abord` });
    }
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) return res.status(404).json({ erreur: 'Site introuvable' });
    await Utilisateur.updateMany({ sites: site._id }, { $pull: { sites: site._id } });
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
