const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vanne.controller');
const { regles } = require('../middleware/validation');

router.get('/state', regles.etatVanne, ctrl.etatVanne);

module.exports = router;
