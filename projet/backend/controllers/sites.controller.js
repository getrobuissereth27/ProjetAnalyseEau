const Site = require('../models/site.model');

// GET /api/sites
exports.listerSites = async (req, res) => {
  try {
    const sites = await Site.find().sort({ createdAt: 1 });
    res.json(sites);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/sites  (reserve a l'administrateur, voir routes/sites.routes.js)
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
