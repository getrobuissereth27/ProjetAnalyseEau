const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const { verifierSeuil } = require('../services/analyse.service');

// POST /api/mesures
exports.creerMesure = async (req, res) => {
  try {
    const { capteur_id, valeur } = req.body;
    if (!capteur_id || valeur === undefined) {
      return res.status(400).json({ erreur: 'capteur_id et valeur sont requis' });
    }

    const mesure = await Mesure.create({ capteur_id, valeur });
    await verifierSeuil(mesure);

    res.status(201).json(mesure);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/mesures/dernieres?site=<id>
exports.dernieresMesures = async (req, res) => {
  try {
    const filtre = req.query.site ? { site_id: req.query.site } : {};
    const capteurs = await Capteur.find(filtre);
    const resultats = await Promise.all(
      capteurs.map(async (capteur) => {
        const derniere = await Mesure.findOne({ capteur_id: capteur._id }).sort({ horodatage: -1 });
        return {
          capteur_id: capteur._id,
          type: capteur.type,
          unite: capteur.unite,
          valeur: derniere ? derniere.valeur : null,
          horodatage: derniere ? derniere.horodatage : null,
        };
      })
    );
    res.json(resultats);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/mesures/historique?capteur=<id>&jours=7
exports.historique = async (req, res) => {
  try {
    const { capteur, jours = 7 } = req.query;
    if (!capteur) return res.status(400).json({ erreur: 'paramètre capteur requis' });

    const depuis = new Date(Date.now() - Number(jours) * 24 * 60 * 60 * 1000);
    const mesures = await Mesure.find({ capteur_id: capteur, horodatage: { $gte: depuis } })
      .sort({ horodatage: 1 });

    res.json(mesures);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
