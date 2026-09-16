const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/capteurs.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', ctrl.listerCapteurs);
router.post('/', proteger, exigerRole('administrateur'), ctrl.creerCapteur);

module.exports = router;
