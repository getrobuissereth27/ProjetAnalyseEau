const bcrypt = require('bcryptjs');
const Utilisateur = require('../models/utilisateur.model');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/utilisateurs   (administrateur uniquement)
exports.listerUtilisateurs = async (req, res) => {
  try {
    const utilisateurs = await Utilisateur.find().select('-motDePasseHash').sort({ createdAt: 1 });
    res.json(utilisateurs);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/utilisateurs   (administrateur uniquement)
exports.creerUtilisateur = async (req, res) => {
  try {
    const { nom, email, motDePasse, role } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ erreur: 'nom, email et motDePasse sont requis' });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const existant = await Utilisateur.findOne({ email: email.toLowerCase() });
    if (existant) {
      return res.status(409).json({ erreur: 'Un compte existe déjà avec cet email' });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, 10);
    const utilisateur = await Utilisateur.create({
      nom,
      email: email.toLowerCase(),
      motDePasseHash,
      role: role === 'administrateur' ? 'administrateur' : 'communautaire',
    });

    res.status(201).json({ id: utilisateur._id, nom: utilisateur.nom, email: utilisateur.email, role: utilisateur.role });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/utilisateurs/moi   body: { nom?, email?, motDePasseActuel? }
// Accessible à n'importe quel utilisateur connecté. Le nom se modifie librement ;
// l'email, étant l'identifiant de connexion, exige le mot de passe actuel en
// confirmation (comme pour /moi/mot-de-passe), pour éviter qu'une session
// laissée ouverte permette de détourner le compte en changeant son email.
exports.modifierMonProfil = async (req, res) => {
  try {
    const { nom, email, motDePasseActuel } = req.body;
    const maj = {};

    if (nom !== undefined) {
      if (!nom.trim()) return res.status(400).json({ erreur: 'Le nom ne peut pas être vide' });
      maj.nom = nom.trim();
    }

    if (email !== undefined) {
      if (!REGEX_EMAIL.test(email)) {
        return res.status(400).json({ erreur: 'Adresse email invalide' });
      }
      if (!motDePasseActuel) {
        return res.status(400).json({ erreur: "Le mot de passe actuel est requis pour changer d'email" });
      }

      const utilisateurActuel = await Utilisateur.findById(req.utilisateur.id);
      if (!utilisateurActuel) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

      const motDePasseValide = await bcrypt.compare(motDePasseActuel, utilisateurActuel.motDePasseHash);
      if (!motDePasseValide) {
        return res.status(401).json({ erreur: 'Mot de passe actuel incorrect' });
      }

      const existant = await Utilisateur.findOne({ email: email.toLowerCase(), _id: { $ne: req.utilisateur.id } });
      if (existant) return res.status(409).json({ erreur: 'Un compte existe déjà avec cet email' });

      maj.email = email.toLowerCase();
    }

    if (Object.keys(maj).length === 0) {
      return res.status(400).json({ erreur: 'Aucune modification fournie' });
    }

    const utilisateur = await Utilisateur.findByIdAndUpdate(req.utilisateur.id, maj, { new: true }).select('-motDePasseHash');
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

    res.json(utilisateur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/utilisateurs/:id   body: { nom?, email? }   (administrateur uniquement)
// Corrige le nom ou l'email d'un compte existant — distinct de /role et /mot-de-passe.
exports.modifierUtilisateur = async (req, res) => {
  try {
    const { nom, email } = req.body;
    const maj = {};

    if (nom !== undefined) {
      if (!nom.trim()) return res.status(400).json({ erreur: 'Le nom ne peut pas être vide' });
      maj.nom = nom.trim();
    }
    if (email !== undefined) {
      if (!REGEX_EMAIL.test(email)) return res.status(400).json({ erreur: 'Adresse email invalide' });
      const existant = await Utilisateur.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (existant) return res.status(409).json({ erreur: 'Un compte existe déjà avec cet email' });
      maj.email = email.toLowerCase();
    }

    const utilisateur = await Utilisateur.findByIdAndUpdate(req.params.id, maj, { new: true }).select('-motDePasseHash');
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

    res.json(utilisateur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/utilisateurs/:id/role   body: { role }   (administrateur uniquement)
exports.changerRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['administrateur', 'communautaire'].includes(role)) {
      return res.status(400).json({ erreur: 'Rôle invalide' });
    }
    // Empêche de se retirer soi-même le rôle admin par erreur (verrouillage accidentel de l'accès à cette page)
    if (req.params.id === req.utilisateur.id && role !== 'administrateur') {
      return res.status(400).json({ erreur: 'Tu ne peux pas retirer ton propre rôle administrateur' });
    }

    const utilisateur = await Utilisateur.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-motDePasseHash');
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

    res.json(utilisateur);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/utilisateurs/:id   (administrateur uniquement)
exports.supprimerUtilisateur = async (req, res) => {
  try {
    if (req.params.id === req.utilisateur.id) {
      return res.status(400).json({ erreur: 'Tu ne peux pas supprimer ton propre compte' });
    }

    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

    if (cible.role === 'administrateur') {
      const nbAdmins = await Utilisateur.countDocuments({ role: 'administrateur' });
      if (nbAdmins <= 1) {
        return res.status(400).json({ erreur: 'Impossible de supprimer le dernier administrateur' });
      }
    }

    await Utilisateur.findByIdAndDelete(req.params.id);
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/utilisateurs/moi/mot-de-passe   body: { motDePasseActuel, nouveauMotDePasse }
// Accessible à n'importe quel utilisateur connecté, pas seulement l'administrateur.
exports.changerMonMotDePasse = async (req, res) => {
  try {
    const { motDePasseActuel, nouveauMotDePasse } = req.body;
    if (!motDePasseActuel || !nouveauMotDePasse) {
      return res.status(400).json({ erreur: 'motDePasseActuel et nouveauMotDePasse sont requis' });
    }
    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    const utilisateur = await Utilisateur.findById(req.utilisateur.id);
    if (!utilisateur) return res.status(404).json({ erreur: 'Utilisateur introuvable' });

    const motDePasseValide = await bcrypt.compare(motDePasseActuel, utilisateur.motDePasseHash);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: 'Mot de passe actuel incorrect' });
    }

    utilisateur.motDePasseHash = await bcrypt.hash(nouveauMotDePasse, 10);
    await utilisateur.save();

    res.json({ modifie: true });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};
