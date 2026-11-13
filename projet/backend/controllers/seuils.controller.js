const Seuil = require('../models/seuil.model');
const Capteur = require('../models/capteur.model');
const { aAccesSite } = require('../middleware/auth.middleware');

// GET /api/thresholds?site=<id>
// Part de la liste des CAPTEURS (pas des seuils), pour qu'un capteur tout juste
// créé apparaisse aussi dans le tableau — même avant qu'un seuil lui soit défini.
exports.listerSeuils = async (req, res) => {
  try {
    if (!req.query.site) return res.status(400).json({ erreur: 'paramètre site requis' });
    if (!aAccesSite(req.utilisateur, req.query.site)) {
      return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });
    }

    const capteurs = await Capteur.find({ site_id: req.query.site });
    const seuils = await Seuil.find({ capteur_id: { $in: capteurs.map((c) => c._id) } });
    const seuilParCapteur = new Map(seuils.map((s) => [s.capteur_id.toString(), s]));

    const resultats = capteurs.map((capteur) => {
      const seuil = seuilParCapteur.get(capteur._id.toString());
      return {
        _id: seuil ? seuil._id : null,
        capteur_id: capteur,
        valeur_min: seuil ? seuil.valeur_min : null,
        valeur_max: seuil ? seuil.valeur_max : null,
        critique_min: seuil ? seuil.critique_min : null,
        critique_max: seuil ? seuil.critique_max : null,
      };
    });

    res.json(resultats);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// Convertit une valeur de formulaire en nombre ou null (champ vide = non défini).
function nombreOuNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// PUT /api/thresholds/:capteurId
// body: { valeur_min, valeur_max, critique_min?, critique_max? }
exports.modifierSeuil = async (req, res) => {
  try {
    const valeur_min = nombreOuNull(req.body.valeur_min);
    const valeur_max = nombreOuNull(req.body.valeur_max);
    const critique_min = nombreOuNull(req.body.critique_min);
    const critique_max = nombreOuNull(req.body.critique_max);

    if (valeur_min === null || valeur_max === null) {
      return res.status(400).json({ erreur: 'valeur_min et valeur_max sont requis' });
    }
    if ([valeur_min, valeur_max, critique_min, critique_max].some(Number.isNaN)) {
      return res.status(400).json({ erreur: 'Les seuils doivent être des nombres' });
    }
    if (valeur_min > valeur_max) {
      return res.status(400).json({ erreur: 'Le seuil minimum doit être inférieur au seuil maximum' });
    }
    // Les seuils critiques sont au-delà de la plage normale : on alerte d'abord,
    // puis on envoie l'email si la situation s'aggrave jusqu'au seuil critique.
    if (critique_min !== null && critique_min > valeur_min) {
      return res.status(400).json({ erreur: 'Le seuil critique minimum doit être inférieur ou égal au seuil minimum' });
    }
    if (critique_max !== null && critique_max < valeur_max) {
      return res.status(400).json({ erreur: 'Le seuil critique maximum doit être supérieur ou égal au seuil maximum' });
    }

    const capteur = await Capteur.findById(req.params.capteurId);
    if (!capteur) return res.status(404).json({ erreur: 'Capteur introuvable' });
    if (!aAccesSite(req.utilisateur, capteur.site_id)) {
      return res.status(403).json({ erreur: "Tu n'as pas accès au site de ce capteur" });
    }

    const seuil = await Seuil.findOneAndUpdate(
      { capteur_id: capteur._id },
      { valeur_min, valeur_max, critique_min, critique_max },
      { new: true, upsert: true }
    );
    res.json(seuil);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
