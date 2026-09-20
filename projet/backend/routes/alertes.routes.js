const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alertes.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', ctrl.listerAlertes);
router.delete('/', proteger, exigerRole('administrateur'), ctrl.supprimerAlertes);
router.delete('/:id', proteger, exigerRole('administrateur'), ctrl.supprimerAlerte);

module.exports = router;
