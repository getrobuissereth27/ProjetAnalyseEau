const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { proteger } = require('../middleware/auth.middleware');

router.post('/login', ctrl.connexion);
router.get('/moi', proteger, ctrl.profil);

module.exports = router;
