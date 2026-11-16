const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { regles } = require('../middleware/validation');
const { proteger } = require('../middleware/auth.middleware');

router.post('/login', regles.connexion, ctrl.connexion);
router.get('/me', proteger, ctrl.profil);

module.exports = router;
