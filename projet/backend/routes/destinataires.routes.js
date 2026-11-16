const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/destinataires.controller');
const { regles } = require('../middleware/validation');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

// Les adresses email sont une donnée sensible : toute la ressource est réservée à l'administrateur.
router.use(proteger, exigerRole('administrateur'));

router.get('/', regles.listerDestinataires, ctrl.listerDestinataires);
router.post('/', regles.ajouterDestinataire, ctrl.ajouterDestinataire);
router.patch('/:id', regles.modifierDestinataire, ctrl.modifierDestinataire);
router.delete('/:id', regles.parId, ctrl.supprimerDestinataire);

module.exports = router;
