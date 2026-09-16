const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mesures.controller');

router.post('/', ctrl.creerMesure);
router.get('/dernieres', ctrl.dernieresMesures);
router.get('/historique', ctrl.historique);

module.exports = router;
