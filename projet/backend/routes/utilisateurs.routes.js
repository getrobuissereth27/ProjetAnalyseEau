const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/utilisateurs.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

// Les droits fins (un administrateur ne gère que les responsables de ses sites)
// sont vérifiés dans le contrôleur.
router.get('/', proteger, exigerRole('administrateur'), ctrl.listerUtilisateurs);
router.post('/', proteger, exigerRole('administrateur'), regles.creerUtilisateur, ctrl.creerUtilisateur);

// Routes "/me" placées AVANT les routes génériques "/:id", pour que "me" ne
// soit jamais interprété comme un identifiant d'utilisateur.
router.patch('/me', proteger, regles.modifierMonProfil, ctrl.modifierMonProfil);
router.patch('/me/password', proteger, regles.changerMonMotDePasse, ctrl.changerMonMotDePasse);

router.patch('/:id/role', proteger, exigerRole('administrateur'), regles.changerRole, ctrl.changerRole);
router.patch('/:id/sites', proteger, exigerRole('superadmin'), regles.attribuerSites, ctrl.attribuerSites);
router.patch('/:id', proteger, exigerRole('administrateur'), regles.modifierUtilisateur, ctrl.modifierUtilisateur);
router.delete('/:id', proteger, exigerRole('administrateur'), regles.parId, ctrl.supprimerUtilisateur);

module.exports = router;
