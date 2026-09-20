const Destinataire = require('../models/destinataire.model');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/destinataires?site=<id>
exports.listerDestinataires = async (req, res) => {
  try {
    const filtre = req.query.site ? { site_id: req.query.site } : {};
    const destinataires = await Destinataire.find(filtre).sort({ createdAt: 1 });
    res.json(destinataires);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/destinataires   body: { site_id, email, nom? }
exports.ajouterDestinataire = async (req, res) => {
  try {
    const { site_id, email, nom } = req.body;
    if (!site_id || !email) {
      return res.status(400).json({ erreur: 'site_id et email sont requis' });
    }
    if (!REGEX_EMAIL.test(email)) {
      return res.status(400).json({ erreur: 'Adresse email invalide' });
    }

    const existant = await Destinataire.findOne({ site_id, email: email.toLowerCase() });
    if (existant) {
      return res.status(409).json({ erreur: 'Cette adresse reçoit déjà les alertes de ce site' });
    }

    const destinataire = await Destinataire.create({ site_id, email: email.toLowerCase(), nom: nom || '' });
    res.status(201).json(destinataire);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/destinataires/:id   body: { email?, nom?, actif? }
exports.modifierDestinataire = async (req, res) => {
  try {
    const { email, nom, actif } = req.body;
    const maj = {};

    if (email !== undefined) {
      if (!REGEX_EMAIL.test(email)) return res.status(400).json({ erreur: 'Adresse email invalide' });
      maj.email = email.toLowerCase();
    }
    if (nom !== undefined) maj.nom = nom;
    if (actif !== undefined) maj.actif = actif;

    const destinataire = await Destinataire.findByIdAndUpdate(req.params.id, maj, { new: true });
    if (!destinataire) return res.status(404).json({ erreur: 'Destinataire introuvable' });

    res.json(destinataire);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/destinataires/:id
exports.supprimerDestinataire = async (req, res) => {
  try {
    const destinataire = await Destinataire.findByIdAndDelete(req.params.id);
    if (!destinataire) return res.status(404).json({ erreur: 'Destinataire introuvable' });
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
