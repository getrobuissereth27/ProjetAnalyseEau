const Destinataire = require('../models/destinataire.model');
const { aAccesSite, filtreSites } = require('../middleware/auth.middleware');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Charge un destinataire et vérifie que l'utilisateur a accès à son site.
async function destinataireAccessible(req, res) {
  const destinataire = await Destinataire.findById(req.params.id);
  if (!destinataire || !aAccesSite(req.utilisateur, destinataire.site_id)) {
    res.status(404).json({ erreur: 'Destinataire introuvable' });
    return null;
  }
  return destinataire;
}

// GET /api/recipients?site=<id>
exports.listerDestinataires = async (req, res) => {
  try {
    const filtre = filtreSites(req.utilisateur, req.query.site);
    if (!filtre) return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });
    const destinataires = await Destinataire.find(filtre).sort({ createdAt: 1 });
    res.json(destinataires);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/recipients   body: { site_id, email, nom? }
exports.ajouterDestinataire = async (req, res) => {
  try {
    const { site_id, email, nom } = req.body;
    if (!site_id || !email) {
      return res.status(400).json({ erreur: 'site_id et email sont requis' });
    }
    if (!aAccesSite(req.utilisateur, site_id)) {
      return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });
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

// PATCH /api/recipients/:id   body: { email?, nom?, actif? }
exports.modifierDestinataire = async (req, res) => {
  try {
    const { email, nom, actif } = req.body;
    const destinataire = await destinataireAccessible(req, res);
    if (!destinataire) return;

    if (email !== undefined) {
      if (!REGEX_EMAIL.test(email)) return res.status(400).json({ erreur: 'Adresse email invalide' });
      destinataire.email = email.toLowerCase();
    }
    if (nom !== undefined) destinataire.nom = nom;
    if (actif !== undefined) destinataire.actif = actif;

    await destinataire.save();
    res.json(destinataire);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/recipients/:id
exports.supprimerDestinataire = async (req, res) => {
  try {
    const destinataire = await destinataireAccessible(req, res);
    if (!destinataire) return;
    await destinataire.deleteOne();
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
