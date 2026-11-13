const jwt = require('jsonwebtoken');
const Utilisateur = require('../models/utilisateur.model');

// Hiérarchie des rôles : un rôle supérieur a tous les droits des rôles inférieurs.
const RANG_ROLE = { communautaire: 0, administrateur: 1, superadmin: 2 };

// Vérifie la présence et la validité du jeton, puis recharge l'utilisateur en
// base pour attacher req.utilisateur avec son rôle et ses sites ACTUELS : une
// attribution de site (ou un changement de rôle) s'applique immédiatement, sans
// attendre l'expiration du jeton.
exports.proteger = async (req, res, next) => {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;

  if (!jeton) {
    return res.status(401).json({ erreur: 'Authentification requise' });
  }

  let contenu;
  try {
    contenu = jwt.verify(jeton, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ erreur: 'Jeton invalide ou expiré' });
  }

  try {
    const utilisateur = await Utilisateur.findById(contenu.sub).select('nom role sites');
    if (!utilisateur) return res.status(401).json({ erreur: 'Compte introuvable' });
    req.utilisateur = {
      id: utilisateur._id.toString(),
      nom: utilisateur.nom,
      role: utilisateur.role,
      sites: (utilisateur.sites || []).map((s) => s.toString()),
    };
    next();
  } catch (err) {
    next(err);
  }
};

// À utiliser après `proteger` : bloque si le rôle est inférieur au rôle requis
// (exigerRole('administrateur') laisse donc aussi passer le superadmin).
exports.exigerRole = (roleRequis) => (req, res, next) => {
  const rang = RANG_ROLE[req.utilisateur?.role] ?? -1;
  if (rang < RANG_ROLE[roleRequis]) {
    return res.status(403).json({ erreur: `Accès réservé au rôle ${roleRequis}` });
  }
  next();
};

exports.estSuperAdmin = (utilisateur) => utilisateur?.role === 'superadmin';

// L'utilisateur a-t-il accès à ce site ? Le superadmin a accès à tous les sites.
exports.aAccesSite = (utilisateur, siteId) => {
  if (!utilisateur || !siteId) return false;
  if (utilisateur.role === 'superadmin') return true;
  return (utilisateur.sites || []).includes(siteId.toString());
};

// Filtre Mongo sur un champ "site" restreint aux sites de l'utilisateur.
// - siteDemande fourni : vérifie l'accès (renvoie null si refusé)
// - sinon : tous les sites de l'utilisateur (aucun filtre pour le superadmin)
exports.filtreSites = (utilisateur, siteDemande, champ = 'site_id') => {
  if (siteDemande) {
    return exports.aAccesSite(utilisateur, siteDemande) ? { [champ]: siteDemande } : null;
  }
  if (utilisateur.role === 'superadmin') return {};
  return { [champ]: { $in: utilisateur.sites || [] } };
};

exports.RANG_ROLE = RANG_ROLE;
