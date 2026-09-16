const bcrypt = require('bcryptjs');
const Utilisateur = require('../models/utilisateur.model');

function sansMotDePasse(utilisateur) {
  return {
    id: utilisateur._id,
    nom: utilisateur.nom,
    email: utilisateur.email,
    role: utilisateur.role,
    createdAt: utilisateur.createdAt,
  };
}

// GET /api/utilisateurs  (admin uniquement)
exports.listerUtilisateurs = async (req, res) => {
  try {
    const utilisateurs = await Utilisateur.find().sort({ createdAt: 1 });
    res.json(utilisateurs.map(sansMotDePasse));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/utilisateurs  (admin uniquement)
exports.creerUtilisateur = async (req, res) => {
  try {
    const { nom, email, motDePasse, role } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ erreur: 'nom, email et motDePasse sont requis' });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    if (role && !['administrateur', 'communautaire'].includes(role)) {
      return res.status(400).json({ erreur: 'Rôle invalide' });
    }

    const existant = await Utilisateur.findOne({ email: email.toLowerCase() });
    if (existant) {
      return res.status(409).json({ erreur: 'Un utilisateur avec cet email existe déjà' });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, 10);
    const utilisateur = await Utilisateur.create({
      nom, email: email.toLowerCase(), motDePasseHash, role: role || 'communautaire',
    });
    res.status(201).json(sansMotDePasse(utilisateur));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PUT /api/utilisateurs/:id  (admin uniquement) — modifie nom / email / rôle
exports.modifierUtilisateur = async (req, res) => {
  try {
    const { nom, email, role } = req.body;
    if (role && !['administrateur', 'communautaire'].includes(role)) {
      return res.status(400).json({ erreur: 'Rôle invalide' });
    }

    const miseAJour = {};
    if (nom) miseAJour.nom = nom;
    if (email) miseAJour.email = email.toLowerCase();
    if (role) miseAJour.role = role;

    const utilisateur = await Utilisateur.findByIdAndUpdate(req.params.id, miseAJour, { new: true });
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    res.json(sansMotDePasse(utilisateur));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/utilisateurs/:id  (admin uniquement) — un admin ne peut pas se supprimer lui-même
exports.supprimerUtilisateur = async (req, res) => {
  try {
    if (req.params.id === req.utilisateur.id) {
      return res.status(400).json({ erreur: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    const utilisateur = await Utilisateur.findByIdAndDelete(req.params.id);
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PUT /api/utilisateurs/moi/mot-de-passe  (n'importe quel utilisateur connecté, pour lui-même)
exports.changerMonMotDePasse = async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({ erreur: 'ancienMotDePasse et nouveauMotDePasse sont requis' });
    }
    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    const utilisateur = await Utilisateur.findById(req.utilisateur.id);
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

    const valide = await bcrypt.compare(ancienMotDePasse, utilisateur.motDePasseHash);
    if (!valide) {
      return res.status(401).json({ erreur: 'Ancien mot de passe incorrect' });
    }

    utilisateur.motDePasseHash = await bcrypt.hash(nouveauMotDePasse, 10);
    await utilisateur.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
