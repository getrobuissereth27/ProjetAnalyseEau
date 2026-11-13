const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Utilisateur = require('../models/utilisateur.model');
const Site = require('../models/site.model');
const { estSuperAdmin } = require('../middleware/auth.middleware');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Règles de gestion des comptes :
// - le superadmin gère tous les comptes, tous les rôles et tous les sites ;
// - un administrateur ne gère que les responsables (rôle communautaire) rattachés
//   à au moins un de SES sites, et ne peut leur attribuer que ses propres sites.

function idsSites(liste) {
  return (liste || []).map((s) => (s._id || s).toString());
}

// Un administrateur peut-il gérer ce compte ?
function peutGerer(moi, cible) {
  if (estSuperAdmin(moi)) return true;
  if (cible.role !== 'communautaire') return false;
  return idsSites(cible.sites).some((s) => moi.sites.includes(s));
}

// Ce que l'appelant a le droit de voir d'un compte : un administrateur ne voit
// que les sites qu'il partage avec ce compte.
function vueUtilisateur(moi, u) {
  const obj = u.toObject ? u.toObject() : { ...u };
  delete obj.motDePasseHash;
  if (!estSuperAdmin(moi)) obj.sites = idsSites(obj.sites).filter((s) => moi.sites.includes(s));
  else obj.sites = idsSites(obj.sites);
  return obj;
}

// Valide une liste d'identifiants de sites : format, existence, et droits de l'appelant.
async function validerSites(moi, sites) {
  if (!Array.isArray(sites)) return { erreur: 'sites doit être un tableau' };
  const ids = [...new Set(sites.map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return { erreur: 'Identifiant de site invalide' };
  if (!estSuperAdmin(moi) && ids.some((id) => !moi.sites.includes(id))) {
    return { erreur: "Tu ne peux attribuer que des sites dont tu es administrateur", statut: 403 };
  }
  const nbExistants = await Site.countDocuments({ _id: { $in: ids } });
  if (nbExistants !== ids.length) return { erreur: 'Site introuvable' };
  return { ids };
}

// GET /api/users   (administrateur ou superadmin)
exports.listerUtilisateurs = async (req, res) => {
  try {
    const moi = req.utilisateur;
    const filtre = estSuperAdmin(moi)
      ? {}
      // L'administrateur voit les comptes rattachés à ses sites (y compris les
      // autres administrateurs de ces sites, en lecture seule) et lui-même.
      : { $or: [{ sites: { $in: moi.sites } }, { _id: moi.id }] };
    const utilisateurs = await Utilisateur.find(filtre).sort({ createdAt: 1 });
    res.json(utilisateurs.map((u) => vueUtilisateur(moi, u)));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// POST /api/users   body: { nom, email, motDePasse, role?, sites? }
exports.creerUtilisateur = async (req, res) => {
  try {
    const moi = req.utilisateur;
    const { nom, email, motDePasse, role = 'communautaire', sites = [] } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ erreur: 'nom, email et motDePasse sont requis' });
    }
    if (!REGEX_EMAIL.test(email)) {
      return res.status(400).json({ erreur: 'Adresse email invalide' });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    if (!Utilisateur.ROLES.includes(role)) {
      return res.status(400).json({ erreur: 'Rôle invalide' });
    }
    if (!estSuperAdmin(moi) && role !== 'communautaire') {
      return res.status(403).json({ erreur: 'Seul le superadmin peut créer un administrateur' });
    }

    const verif = await validerSites(moi, sites);
    if (verif.erreur) return res.status(verif.statut || 400).json({ erreur: verif.erreur });
    if (role !== 'superadmin' && verif.ids.length === 0) {
      return res.status(400).json({ erreur: 'Attribue au moins un site à ce compte' });
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
      role,
      sites: role === 'superadmin' ? [] : verif.ids,
    });

    res.status(201).json(vueUtilisateur(moi, utilisateur));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/users/:id/sites   body: { sites: [...] }
// Superadmin : remplace la liste complète. Administrateur : ne modifie que la
// partie de la liste qui concerne ses propres sites (les autres sont conservés).
exports.attribuerSites = async (req, res) => {
  try {
    const moi = req.utilisateur;
    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    if (!peutGerer(moi, cible)) return res.status(403).json({ erreur: "Tu n'as pas les droits sur ce compte" });
    if (cible.role === 'superadmin') {
      return res.status(400).json({ erreur: 'Le superadmin a déjà accès à tous les sites' });
    }

    const verif = await validerSites(moi, req.body.sites);
    if (verif.erreur) return res.status(verif.statut || 400).json({ erreur: verif.erreur });

    let nouveaux = verif.ids;
    if (!estSuperAdmin(moi)) {
      const horsPerimetre = idsSites(cible.sites).filter((s) => !moi.sites.includes(s));
      nouveaux = [...horsPerimetre, ...verif.ids];
    }
    if (nouveaux.length === 0) {
      return res.status(400).json({ erreur: 'Un compte doit appartenir à au moins un site' });
    }

    cible.sites = nouveaux;
    await cible.save();
    res.json(vueUtilisateur(moi, cible));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/users/me   body: { nom?, email?, motDePasseActuel? }
// Accessible à n'importe quel utilisateur connecté. Le nom se modifie librement ;
// l'email, étant l'identifiant de connexion, exige le mot de passe actuel en
// confirmation (comme pour /me/password), pour éviter qu'une session
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

// PATCH /api/users/:id   body: { nom?, email? }
// Corrige le nom ou l'email d'un compte existant — distinct de /role, /sites et /mot-de-passe.
exports.modifierUtilisateur = async (req, res) => {
  try {
    const moi = req.utilisateur;
    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    if (cible._id.toString() !== moi.id && !peutGerer(moi, cible)) {
      return res.status(403).json({ erreur: "Tu n'as pas les droits sur ce compte" });
    }

    const { nom, email } = req.body;
    if (nom !== undefined) {
      if (!nom.trim()) return res.status(400).json({ erreur: 'Le nom ne peut pas être vide' });
      cible.nom = nom.trim();
    }
    if (email !== undefined) {
      if (!REGEX_EMAIL.test(email)) return res.status(400).json({ erreur: 'Adresse email invalide' });
      const existant = await Utilisateur.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (existant) return res.status(409).json({ erreur: 'Un compte existe déjà avec cet email' });
      cible.email = email.toLowerCase();
    }

    await cible.save();
    res.json(vueUtilisateur(moi, cible));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/users/:id/role   body: { role }   (superadmin uniquement)
exports.changerRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!Utilisateur.ROLES.includes(role)) {
      return res.status(400).json({ erreur: 'Rôle invalide' });
    }
    // Empêche de se retirer soi-même le rôle superadmin par erreur (perte de l'accès à la gestion des sites)
    if (req.params.id === req.utilisateur.id && role !== 'superadmin') {
      return res.status(400).json({ erreur: 'Tu ne peux pas retirer ton propre rôle superadmin' });
    }

    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    if (role !== 'superadmin' && cible.role !== 'superadmin' && cible.sites.length === 0) {
      return res.status(400).json({ erreur: "Attribue d'abord au moins un site à ce compte" });
    }

    cible.role = role;
    await cible.save();
    res.json(vueUtilisateur(req.utilisateur, cible));
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// DELETE /api/users/:id
exports.supprimerUtilisateur = async (req, res) => {
  try {
    if (req.params.id === req.utilisateur.id) {
      return res.status(400).json({ erreur: 'Tu ne peux pas supprimer ton propre compte' });
    }

    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    if (!peutGerer(req.utilisateur, cible)) {
      return res.status(403).json({ erreur: "Tu n'as pas les droits sur ce compte" });
    }

    if (cible.role === 'superadmin') {
      const nb = await Utilisateur.countDocuments({ role: 'superadmin' });
      if (nb <= 1) {
        return res.status(400).json({ erreur: 'Impossible de supprimer le dernier superadmin' });
      }
    }

    await Utilisateur.findByIdAndDelete(req.params.id);
    res.json({ supprime: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
};

// PATCH /api/users/me/password   body: { motDePasseActuel, nouveauMotDePasse }
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
