const Site = require('../models/site.model');
const Utilisateur = require('../models/utilisateur.model');
const Capteur = require('../models/capteur.model');
const Mesure = require('../models/mesure.model');
const { estSuperAdmin } = require('../middleware/auth.middleware');
const { testerConnexion } = require('../services/raspberry.service');

// Refuse d'attribuer à un site l'adresse du Raspberry d'un AUTRE site.
async function adresseDejaUtilisee(ip, siteId = null) {
  if (!ip) return null;
  const filtre = { ipRaspberry: ip };
  if (siteId) filtre._id = { $ne: siteId };
  return Site.findOne(filtre);
}

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
    const { nom, localisation, ipRaspberry, portRaspberry } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ erreur: 'Le nom du site est requis' });
    }
    const autre = await adresseDejaUtilisee(ipRaspberry);
    if (autre) return res.status(409).json({ erreur: `Cette adresse est déjà utilisée par le site « ${autre.nom} »` });

    const site = await Site.create({
      nom: nom.trim(),
      localisation: localisation || '',
      ipRaspberry: ipRaspberry || '',
      ...(portRaspberry ? { portRaspberry } : {}),
    });
    res.status(201).json(site);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/sites/:id   body: { nom?, localisation?, ipRaspberry?, portRaspberry? }   (superadmin uniquement)
exports.modifierSite = async (req, res) => {
  try {
    const { nom, localisation, ipRaspberry, portRaspberry } = req.body;
    const maj = {};
    if (nom !== undefined) {
      if (!nom.trim()) return res.status(400).json({ erreur: 'Le nom du site est requis' });
      maj.nom = nom.trim();
    }
    if (localisation !== undefined) maj.localisation = localisation;
    if (ipRaspberry !== undefined) {
      const autre = await adresseDejaUtilisee(ipRaspberry, req.params.id);
      if (autre) return res.status(409).json({ erreur: `Cette adresse est déjà utilisée par le site « ${autre.nom} »` });
      maj.ipRaspberry = ipRaspberry || '';
    }
    if (portRaspberry !== undefined && portRaspberry !== null) maj.portRaspberry = portRaspberry;

    const site = await Site.findByIdAndUpdate(req.params.id, maj, { new: true });
    if (!site) return res.status(404).json({ erreur: 'Site introuvable' });
    res.json(site);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/sites/:id/raspberry/statut   (superadmin uniquement)
// Teste si le Raspberry Pi du site répond à l'adresse configurée (connexion TCP
// sur ipRaspberry:portRaspberry) et indique la date de la dernière mesure reçue.
exports.statutRaspberry = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ erreur: 'Site introuvable' });

    const capteurs = await Capteur.find({ site_id: site._id }).select('_id');
    const derniere = await Mesure.findOne({ capteur_id: { $in: capteurs.map((c) => c._id) } })
      .sort({ horodatage: -1 }).select('horodatage');
    const dernierContact = derniere ? derniere.horodatage : null;

    if (!site.ipRaspberry) {
      return res.json({ configure: false, joignable: null, dernierContact });
    }
    const resultat = await testerConnexion(site.ipRaspberry, site.portRaspberry);
    res.json({ configure: true, ip: site.ipRaspberry, port: site.portRaspberry, ...resultat, dernierContact });
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
