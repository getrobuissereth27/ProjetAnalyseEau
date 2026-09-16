const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/destinataires.controller');
const { proteger, exigerRole } = require('../middleware/auth.middleware');

router.get('/', proteger, exigerRole('administrateur'), ctrl.listerDestinataires);
router.post('/', proteger, exigerRole('administrateur'), ctrl.ajouterDestinataire);
router.delete('/:id', proteger, exigerRole('administrateur'), ctrl.supprimerDestinataire);

module.exports = router;
