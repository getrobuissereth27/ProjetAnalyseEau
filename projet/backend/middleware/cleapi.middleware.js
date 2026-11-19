const crypto = require('crypto');
const Capteur = require('../models/capteur.model');
const Site = require('../models/site.model');

// Empreinte SHA-256 (hexadécimal) d'une clé d'API : seule cette empreinte est stockée.
function hasherCle(cle) {
  return crypto.createHash('sha256').update(String(cle)).digest('hex');
}

// Génère une nouvelle clé aléatoire (256 bits) et son empreinte.
function genererCle() {
  const cle = crypto.randomBytes(32).toString('hex');
  return { cle, hash: hasherCle(cle) };
}

function egalesEnTempsConstant(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/*
 * Authentifie le Raspberry Pi sur POST /api/measurements.
 *
 * Le client envoie la clé de SON site dans l'en-tête X-API-Key. Le serveur retrouve
 * le site à partir du capteur visé, puis compare l'empreinte de la clé reçue à celle
 * du site (comparaison en temps constant).
 *
 * - site avec clé configurée : clé valide obligatoire, sinon 401 ;
 * - site sans clé : accepté, sauf si CLE_API_OBLIGATOIRE=true (alors 401).
 *   Ce mode de transition permet de déployer sans casser un Raspberry Pi existant ;
 *   en production, activer CLE_API_OBLIGATOIRE et générer une clé par site.
 *
 * Doit passer APRÈS la validation des champs (capteur_id est déjà un ObjectId valide).
 */
async function verifierCleApi(req, res, next) {
  try {
    const capteur = await Capteur.findById(req.body.capteur_id).select('site_id');
    // Capteur inconnu : on laisse le contrôleur répondre (pas d'information sur les clés)
    if (!capteur) return res.status(404).json({ erreur: 'Capteur introuvable' });

    const site = await Site.findById(capteur.site_id).select('+cleApiHash');
    const obligatoire = String(process.env.CLE_API_OBLIGATOIRE).toLowerCase() === 'true';

    if (!site || !site.cleApiHash) {
      if (obligatoire) return res.status(401).json({ erreur: "Clé d'API requise : aucune clé n'est configurée pour ce site" });
      return next();
    }

    const cle = req.get('X-API-Key');
    if (!cle || !egalesEnTempsConstant(hasherCle(cle), site.cleApiHash)) {
      return res.status(401).json({ erreur: "Clé d'API invalide ou absente" });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ erreur: err.message });
  }
}

module.exports = { verifierCleApi, hasherCle, genererCle };
