const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Utilisateur = require('../models/utilisateur.model');

// POST /api/auth/login
exports.connexion = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    if (!email || !motDePasse) {
      return res.status(400).json({ erreur: 'email et motDePasse sont requis' });
    }

    const utilisateur = await Utilisateur.findOne({ email: email.toLowerCase() });
    if (!utilisateur) {
      return res.status(401).json({ erreur: 'Identifiants invalides' });
    }

    const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.motDePasseHash);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: 'Identifiants invalides' });
    }

    const jeton = jwt.sign(
      { sub: utilisateur._id, role: utilisateur.role, nom: utilisateur.nom },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      jeton,
      utilisateur: { id: utilisateur._id, nom: utilisateur.nom, email: utilisateur.email, role: utilisateur.role },
    });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// GET /api/auth/moi (nécessite un jeton valide, voir middleware)
exports.profil = async (req, res) => {
  res.json(req.utilisateur);
};
