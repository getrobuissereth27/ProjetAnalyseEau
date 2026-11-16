const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sites.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', proteger, ctrl.listerSites);
router.post('/', proteger, exigerRole('superadmin'), regles.creerSite, ctrl.creerSite);
router.patch('/:id', proteger, exigerRole('superadmin'), regles.modifierSite, ctrl.modifierSite);
router.delete('/:id', proteger, exigerRole('superadmin'), regles.parId, ctrl.supprimerSite);

module.exports = router;
