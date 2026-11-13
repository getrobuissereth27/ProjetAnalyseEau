const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sites.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', proteger, ctrl.listerSites);
router.post('/', proteger, exigerRole('superadmin'), ctrl.creerSite);
router.patch('/:id', proteger, exigerRole('superadmin'), ctrl.modifierSite);
router.delete('/:id', proteger, exigerRole('superadmin'), ctrl.supprimerSite);

module.exports = router;
