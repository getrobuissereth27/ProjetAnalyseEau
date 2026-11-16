const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mesures.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.post('/', regles.creerMesure, ctrl.creerMesure);
router.get('/latest', proteger, regles.dernieresMesures, ctrl.dernieresMesures);
router.get('/history', proteger, regles.historique, ctrl.historique);
router.delete('/', proteger, exigerRole('administrateur'), regles.supprimerMesures, ctrl.supprimerMesures);
router.delete('/:id', proteger, exigerRole('administrateur'), regles.parId, ctrl.supprimerMesure);

module.exports = router;
