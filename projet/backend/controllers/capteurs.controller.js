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
    const { site_id, type, modele, unite, broche } = req.body;
    if (!site_id || !type || !modele || !unite) {
      return res.status(400).json({ erreur: 'site_id, type, modele et unite sont requis' });
    }

    // Une broche Arduino ne peut être partagée par deux capteurs du même site —
    // vérification indépendante de ce que montre l'interface, pour un appel direct à l'API aussi.
    if (broche) {
      const conflit = await Capteur.findOne({ site_id, broche });
      if (conflit) {
        return res.status(409).json({
          erreur: `La broche ${broche} est déjà utilisée par le capteur "${conflit.type}" sur ce site`,
        });
      }
    }

    const capteur = await Capteur.create({ site_id, type, modele, unite, broche: broche || '' });
    res.status(201).json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/capteurs/:id/actif   body: { actif: true|false }
// Un capteur désactivé disparaît des cartes du tableau de bord et n'est plus
// jamais comparé aux seuils (voir services/analyse.service.js) — mais reste
// visible dans la page de configuration pour pouvoir être réactivé plus tard.
exports.changerActivationCapteur = async (req, res) => {
  try {
    const { actif } = req.body;
    if (typeof actif !== 'boolean') {
      return res.status(400).json({ erreur: 'Le champ actif (booléen) est requis' });
    }

    const capteur = await Capteur.findByIdAndUpdate(req.params.id, { actif }, { new: true });
    if (!capteur) return res.status(404).json({ erreur: 'Capteur introuvable' });

    res.json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/capteurs/:id   body: { modele?, unite?, broche? }
// Couvre le scénario "remplacer un capteur existant" (chapitre acquisition,
// section extensibilité) : même capteur logique, nouveau modèle physique —
// le type et le site ne changent jamais via cette route.
exports.modifierCapteur = async (req, res) => {
  try {
    const { modele, unite, broche } = req.body;
    const capteur = await Capteur.findById(req.params.id);
    if (!capteur) return res.status(404).json({ erreur: 'Capteur introuvable' });

    if (modele !== undefined) {
      if (!modele.trim()) return res.status(400).json({ erreur: 'Le modèle ne peut pas être vide' });
      capteur.modele = modele.trim();
    }
    if (unite !== undefined) {
      if (!unite.trim()) return res.status(400).json({ erreur: "L'unité ne peut pas être vide" });
      capteur.unite = unite.trim();
    }
    if (broche !== undefined) {
      if (broche) {
        const conflit = await Capteur.findOne({ site_id: capteur.site_id, broche, _id: { $ne: capteur._id } });
        if (conflit) {
          return res.status(409).json({
            erreur: `La broche ${broche} est déjà utilisée par le capteur "${conflit.type}" sur ce site`,
          });
        }
      }
      capteur.broche = broche || '';
    }

    await capteur.save();
    res.json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
