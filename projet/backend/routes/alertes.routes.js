const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/seuils.controller');

router.get('/', ctrl.listerAlertes);

module.exports = router;
