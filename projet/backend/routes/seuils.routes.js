const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/seuils.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', ctrl.listerSeuils);
router.put('/:capteurId', proteger, exigerRole('administrateur'), ctrl.modifierSeuil);

module.exports = router;
