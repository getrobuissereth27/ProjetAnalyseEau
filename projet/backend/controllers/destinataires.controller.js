const Destinataire = require('../models/destinataire.model');

// GET /api/destinataires?site=<id>  (admin uniquement)
exports.listerDestinataires = async (req, res) => {
  try {
    const filtre = req.query.site ? { site_id: req.query.site } : {};
    const destinataires = await Destinataire.find(filtre).sort({ createdAt: 1 });
    res.json(destinataires);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/destinataires  (admin uniquement)
exports.ajouterDestinataire = async (req, res) => {
  try {
    const { site_id, email } = req.body;
    if (!site_id || !email) {
      return res.status(400).json({ erreur: 'site_id et email sont requis' });
    }
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) {
      return res.status(400).json({ erreur: 'Adresse email invalide' });
    }

    const existant = await Destinataire.findOne({ site_id, email: email.toLowerCase() });
    if (existant) {
      return res.status(409).json({ erreur: 'Cette adresse est déjà destinataire pour ce site' });
    }

    const destinataire = await Destinataire.create({ site_id, email: email.toLowerCase() });
    res.status(201).json(destinataire);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/destinataires/:id  (admin uniquement)
exports.supprimerDestinataire = async (req, res) => {
  try {
    const destinataire = await Destinataire.findByIdAndDelete(req.params.id);
    if (!destinataire) return res.status(404).json({ erreur: 'Destinataire introuvable' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
