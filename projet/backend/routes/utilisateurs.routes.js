const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/utilisateurs.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

// Le changement de mot de passe est ouvert à tout utilisateur connecté, pour lui-même —
// déclaré AVANT la route /:id pour éviter que "moi" soit interprété comme un id.
router.put('/moi/mot-de-passe', proteger, ctrl.changerMonMotDePasse);

router.get('/', proteger, exigerRole('administrateur'), ctrl.listerUtilisateurs);
router.post('/', proteger, exigerRole('administrateur'), ctrl.creerUtilisateur);
router.put('/:id', proteger, exigerRole('administrateur'), ctrl.modifierUtilisateur);
router.delete('/:id', proteger, exigerRole('administrateur'), ctrl.supprimerUtilisateur);

module.exports = router;
