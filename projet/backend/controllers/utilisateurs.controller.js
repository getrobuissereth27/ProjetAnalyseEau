const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Utilisateur = require('../models/utilisateur.model');
const Site = require('../models/site.model');
const { estSuperAdmin } = require('../middleware/auth.middleware');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Règles de gestion des comptes :
// - le superadmin gère tous les comptes, tous les rôles et tous les sites ;
//   c'est lui qui crée les sites et y nomme les premiers administrateurs.
// - SEUL le superadmin attribue ou retire des sites à un compte.
// - un administrateur peut ajouter des responsables communautaires ET d'autres
//   administrateurs : le nouveau compte est rattaché automatiquement au site de
//   l'administrateur (celui qu'il a sélectionné s'il en gère plusieurs).
//   Sur un compte existant, il a le contrôle complet (nom/email, rôle,
//   suppression) uniquement si TOUS les sites de ce compte font partie des siens.
// - personne d'autre que le superadmin ne touche à un compte superadmin.
const ROLES_ATTRIBUABLES_PAR_ADMIN = ['communautaire', 'administrateur'];

function idsSites(liste) {
  return (liste || []).map((s) => (s._id || s).toString());
}

// Peut-il attribuer / retirer des sites à ce compte ? Réservé au superadmin.
function peutGererSites(moi, cible) {
  return estSuperAdmin(moi) && cible.role !== 'superadmin';
}

// A-t-il le contrôle complet de ce compte (modifier, changer le rôle, supprimer) ?
function controleComplet(moi, cible) {
  if (estSuperAdmin(moi)) return true;
  if (cible.role === 'superadmin' || cible._id.toString() === moi.id) return false;
  const sites = idsSites(cible.sites);
  return sites.length > 0 && sites.every((s) => moi.sites.includes(s));
}

// Ce que l'appelant a le droit de voir d'un compte : un administrateur ne voit
// que les sites qu'il partage avec ce compte. Les droits calculés sont joints
// pour que l'interface n'affiche que les actions autorisées.
function vueUtilisateur(moi, u) {
  const obj = u.toObject ? u.toObject() : { ...u };
  delete obj.motDePasseHash;
  const complet = controleComplet(moi, u);
  obj.droits = {
    modifier: complet || u._id.toString() === moi.id,
    supprimer: complet && u._id.toString() !== moi.id,
    role: complet && u._id.toString() !== moi.id,
    sites: peutGererSites(moi, u),
    autresSites: !estSuperAdmin(moi) && idsSites(u.sites).some((s) => !moi.sites.includes(s)),
  };
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
    const { nom, email, motDePasse, role = 'communautaire' } = req.body;
    let { sites = [] } = req.body;
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
    if (!estSuperAdmin(moi) && !ROLES_ATTRIBUABLES_PAR_ADMIN.includes(role)) {
      return res.status(403).json({ erreur: 'Seul le superadmin peut créer un superadmin' });
    }
    // Un administrateur n'attribue pas de sites : le compte rejoint SON site.
    // S'il en gère plusieurs, l'interface envoie le site sélectionné (un seul).
    if (!estSuperAdmin(moi)) {
      if (!Array.isArray(sites) || sites.length === 0) {
        if (moi.sites.length !== 1) {
          return res.status(400).json({ erreur: 'Indique le site auquel rattacher ce compte' });
        }
        sites = [moi.sites[0]];
      }
      if (sites.length !== 1) {
        return res.status(403).json({ erreur: "Seul le super administrateur peut attribuer plusieurs sites" });
      }
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

// PATCH /api/users/:id/sites   body: { sites: [...] }   (superadmin uniquement)
// Remplace la liste complète des sites du compte.
exports.attribuerSites = async (req, res) => {
  try {
    const moi = req.utilisateur;
    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    if (!peutGererSites(moi, cible)) return res.status(403).json({ erreur: "Tu n'as pas les droits sur ce compte" });
    if (cible.role === 'superadmin') {
      return res.status(400).json({ erreur: 'Le superadmin a déjà accès à tous les sites' });
    }

    const verif = await validerSites(moi, req.body.sites);
    if (verif.erreur) return res.status(verif.statut || 400).json({ erreur: verif.erreur });

    const nouveaux = verif.ids;
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
    if (cible._id.toString() !== moi.id && !controleComplet(moi, cible)) {
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

// PATCH /api/users/:id/role   body: { role }
// Superadmin : tous les rôles. Administrateur : communautaire ⇄ administrateur,
// uniquement sur les comptes dont il a le contrôle complet.
exports.changerRole = async (req, res) => {
  try {
    const moi = req.utilisateur;
    const { role } = req.body;
    if (!Utilisateur.ROLES.includes(role)) {
      return res.status(400).json({ erreur: 'Rôle invalide' });
    }
    if (req.params.id === moi.id) {
      return res.status(400).json({ erreur: 'Tu ne peux pas changer ton propre rôle' });
    }
    if (!estSuperAdmin(moi) && !ROLES_ATTRIBUABLES_PAR_ADMIN.includes(role)) {
      return res.status(403).json({ erreur: 'Seul le superadmin peut nommer un superadmin' });
    }

    const cible = await Utilisateur.findById(req.params.id);
    if (!cible) return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    if (!controleComplet(moi, cible)) {
      return res.status(403).json({ erreur: "Tu n'as pas les droits sur ce compte" });
    }
    if (cible.role === 'superadmin' && role !== 'superadmin') {
      const nb = await Utilisateur.countDocuments({ role: 'superadmin' });
      if (nb <= 1) return res.status(400).json({ erreur: 'Impossible de rétrograder le dernier superadmin' });
    }
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
    if (!controleComplet(req.utilisateur, cible)) {
      return res.status(403).json({
        erreur: "Ce compte appartient aussi à des sites que tu ne gères pas : demande au super administrateur",
      });
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
