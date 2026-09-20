const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/capteurs.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', ctrl.listerCapteurs);
router.post('/', proteger, exigerRole('administrateur'), ctrl.creerCapteur);
router.patch('/:id/actif', proteger, exigerRole('administrateur'), ctrl.changerActivationCapteur);
router.patch('/:id', proteger, exigerRole('administrateur'), ctrl.modifierCapteur);

module.exports = router;
