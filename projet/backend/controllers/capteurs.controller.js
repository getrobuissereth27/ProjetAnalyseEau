const Capteur = require('../models/capteur.model');

// GET /api/capteurs?site=<id>
exports.listerCapteurs = async (req, res) => {
  try {
    const filtre = req.query.site ? { site_id: req.query.site } : {};
    const capteurs = await Capteur.find(filtre);
    res.json(capteurs);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/capteurs
exports.creerCapteur = async (req, res) => {
  try {
    const { site_id, type, modele, unite, canal_adc } = req.body;
    if (!site_id || !type || !modele || !unite) {
      return res.status(400).json({ erreur: 'site_id, type, modele et unite sont requis' });
    }

    // Le canal ADC (0-7) ne peut être partagé par deux capteurs analogiques du
    // même site — cette vérification est le vrai garde-fou, indépendant de ce
    // que montre (ou pas) l'interface, pour un appel direct à l'API aussi.
    if (canal_adc !== null && canal_adc !== undefined) {
      const conflit = await Capteur.findOne({ site_id, canal_adc });
      if (conflit) {
        return res.status(409).json({
          erreur: `Le canal ADC ${canal_adc} est déjà utilisé par le capteur "${conflit.type}" sur ce site`,
        });
      }
    }

    const capteur = await Capteur.create({ site_id, type, modele, unite, canal_adc });
    res.status(201).json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
