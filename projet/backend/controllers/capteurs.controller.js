const Capteur = require('../models/capteur.model');
const Mesure = require('../models/mesure.model');
const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const { aAccesSite } = require('../middleware/auth.middleware');
const { resoudreAlertesDefaillance } = require('../services/surveillance.service');

// Charge un capteur et vérifie que l'utilisateur a accès à son site.
// Envoie la réponse d'erreur et renvoie null si ce n'est pas le cas.
async function capteurAccessible(req, res) {
  const capteur = await Capteur.findById(req.params.id);
  if (!capteur) {
    res.status(404).json({ erreur: 'Capteur introuvable' });
    return null;
  }
  if (!aAccesSite(req.utilisateur, capteur.site_id)) {
    res.status(403).json({ erreur: "Tu n'as pas accès au site de ce capteur" });
    return null;
  }
  return capteur;
}

function validerDelai(delai) {
  const n = Number(delai);
  if (!Number.isFinite(n) || n < Capteur.DELAI_DEFAILLANCE_MIN_S) {
    return { erreur: `Le délai de défaillance doit être un nombre ≥ ${Capteur.DELAI_DEFAILLANCE_MIN_S} secondes` };
  }
  return { valeur: Math.round(n) };
}

// GET /api/sensors?site=<id>
// Reste public : le client Raspberry Pi l'appelle sans jeton pour connaître ses capteurs.
exports.listerCapteurs = async (req, res) => {
  try {
    const filtre = req.query.site ? { site_id: req.query.site } : {};
    const capteurs = await Capteur.find(filtre);
    res.json(capteurs);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/sensors
exports.creerCapteur = async (req, res) => {
  try {
    const { site_id, type, modele, unite, broche, delaiDefaillanceSecondes } = req.body;
    if (!site_id || !type || !modele || !unite) {
      return res.status(400).json({ erreur: 'site_id, type, modele et unite sont requis' });
    }
    if (!aAccesSite(req.utilisateur, site_id)) {
      return res.status(403).json({ erreur: "Tu n'as pas accès à ce site" });
    }

    const donnees = { site_id, type, modele, unite, broche: broche || '' };
    if (delaiDefaillanceSecondes !== undefined && delaiDefaillanceSecondes !== '') {
      const delai = validerDelai(delaiDefaillanceSecondes);
      if (delai.erreur) return res.status(400).json({ erreur: delai.erreur });
      donnees.delaiDefaillanceSecondes = delai.valeur;
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

    const capteur = await Capteur.create(donnees);
    res.status(201).json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/sensors/:id/active   body: { actif: true|false }
// Un capteur désactivé disparaît des cartes du tableau de bord et n'est plus
// jamais comparé aux seuils (voir services/analyse.service.js) — mais reste
// visible dans la page de configuration pour pouvoir être réactivé plus tard.
exports.changerActivationCapteur = async (req, res) => {
  try {
    const { actif } = req.body;
    if (typeof actif !== 'boolean') {
      return res.status(400).json({ erreur: 'Le champ actif (booléen) est requis' });
    }

    const capteur = await capteurAccessible(req, res);
    if (!capteur) return;

    capteur.actif = actif;
    await capteur.save();
    // Un capteur volontairement désactivé n'est plus « en panne ».
    if (!actif) await resoudreAlertesDefaillance(capteur._id);

    res.json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/sensors/:id   body: { modele?, unite?, broche?, delaiDefaillanceSecondes? }
// Couvre le scénario "remplacer un capteur existant" (chapitre acquisition,
// section extensibilité) : même capteur logique, nouveau modèle physique —
// le type et le site ne changent jamais via cette route.
// Permet aussi de régler le délai sans mesure avant de déclarer le capteur défectueux.
exports.modifierCapteur = async (req, res) => {
  try {
    const { modele, unite, broche, delaiDefaillanceSecondes } = req.body;
    const capteur = await capteurAccessible(req, res);
    if (!capteur) return;

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
    if (delaiDefaillanceSecondes !== undefined) {
      const delai = validerDelai(delaiDefaillanceSecondes);
      if (delai.erreur) return res.status(400).json({ erreur: delai.erreur });
      capteur.delaiDefaillanceSecondes = delai.valeur;
    }

    await capteur.save();
    res.json(capteur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/sensors/:id
// Suppression définitive — contrairement à PATCH .../active (désactivation réversible),
// ceci efface aussi l'historique du capteur : ses mesures, son seuil, et ses alertes.
exports.supprimerCapteur = async (req, res) => {
  try {
    const capteur = await capteurAccessible(req, res);
    if (!capteur) return;

    const mesures = await Mesure.find({ capteur_id: capteur._id }).select('_id');
    const idsMesures = mesures.map((m) => m._id);

    await Alerte.deleteMany({ $or: [{ capteur_id: capteur._id }, { mesure_id: { $in: idsMesures } }] });
    await Mesure.deleteMany({ capteur_id: capteur._id });
    await Seuil.deleteOne({ capteur_id: capteur._id });
    await capteur.deleteOne();

    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
