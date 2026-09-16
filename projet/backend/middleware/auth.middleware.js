const jwt = require('jsonwebtoken');

// Vérifie la présence et la validité du jeton, attache req.utilisateur
exports.proteger = (req, res, next) => {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;

  if (!jeton) {
    return res.status(401).json({ erreur: 'Authentification requise' });
  }

  try {
    const contenu = jwt.verify(jeton, process.env.JWT_SECRET);
    req.utilisateur = { id: contenu.sub, nom: contenu.nom, role: contenu.role };
    next();
  } catch (err) {
    return res.status(401).json({ erreur: 'Jeton invalide ou expiré' });
  }
};

// À utiliser après `proteger` : bloque si le rôle ne correspond pas
exports.exigerRole = (roleRequis) => (req, res, next) => {
  if (!req.utilisateur || req.utilisateur.role !== roleRequis) {
    return res.status(403).json({ erreur: `Accès réservé au rôle ${roleRequis}` });
  }
  next();
};
