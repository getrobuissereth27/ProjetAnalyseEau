const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alertes.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', proteger, regles.listerAlertes, ctrl.listerAlertes);
router.delete('/', proteger, exigerRole('administrateur'), regles.supprimerAlertes, ctrl.supprimerAlertes);
router.delete('/:id', proteger, exigerRole('administrateur'), regles.parId, ctrl.supprimerAlerte);

module.exports = router;
