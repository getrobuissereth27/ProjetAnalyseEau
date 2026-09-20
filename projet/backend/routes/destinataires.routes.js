const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/destinataires.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

// Les adresses email sont une donnée sensible : toute la ressource est réservée à l'administrateur.
router.use(proteger, exigerRole('administrateur'));

router.get('/', ctrl.listerDestinataires);
router.post('/', ctrl.ajouterDestinataire);
router.patch('/:id', ctrl.modifierDestinataire);
router.delete('/:id', ctrl.supprimerDestinataire);

module.exports = router;
