const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mesures.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.post('/', ctrl.creerMesure);
router.get('/dernieres', ctrl.dernieresMesures);
router.get('/historique', ctrl.historique);
router.delete('/', proteger, exigerRole('administrateur'), ctrl.supprimerMesures);
router.delete('/:id', proteger, exigerRole('administrateur'), ctrl.supprimerMesure);

module.exports = router;
