const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/seuils.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', proteger, regles.listerSeuils, ctrl.listerSeuils);
router.put('/:capteurId', proteger, exigerRole('administrateur'), regles.modifierSeuil, ctrl.modifierSeuil);

module.exports = router;
