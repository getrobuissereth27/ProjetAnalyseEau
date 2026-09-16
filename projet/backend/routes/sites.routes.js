const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sites.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', ctrl.listerSites);
router.post('/', proteger, exigerRole('administrateur'), ctrl.creerSite);

module.exports = router;
