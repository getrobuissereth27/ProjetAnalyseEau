const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/utilisateurs.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', proteger, exigerRole('administrateur'), ctrl.listerUtilisateurs);
router.post('/', proteger, exigerRole('administrateur'), ctrl.creerUtilisateur);

// Routes "/me" placées AVANT les routes génériques "/:id", pour que "me" ne
// soit jamais interprété comme un identifiant d'utilisateur.
router.patch('/me', proteger, ctrl.modifierMonProfil);
router.patch('/me/password', proteger, ctrl.changerMonMotDePasse);

router.patch('/:id/role', proteger, exigerRole('administrateur'), ctrl.changerRole);
router.patch('/:id', proteger, exigerRole('administrateur'), ctrl.modifierUtilisateur);
router.delete('/:id', proteger, exigerRole('administrateur'), ctrl.supprimerUtilisateur);

module.exports = router;
