const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/capteurs.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', regles.listerCapteurs, ctrl.listerCapteurs);
router.post('/', proteger, exigerRole('administrateur'), regles.creerCapteur, ctrl.creerCapteur);
router.patch('/:id/active', proteger, exigerRole('administrateur'), regles.changerActivationCapteur, ctrl.changerActivationCapteur);
router.patch('/:id', proteger, exigerRole('administrateur'), regles.modifierCapteur, ctrl.modifierCapteur);
router.delete('/:id', proteger, exigerRole('administrateur'), regles.parId, ctrl.supprimerCapteur);

module.exports = router;
