const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vanne.controller');

router.get('/state', ctrl.etatVanne);

module.exports = router;
