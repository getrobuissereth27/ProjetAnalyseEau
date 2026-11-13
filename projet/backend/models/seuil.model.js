const mongoose = require('mongoose');

// Deux niveaux de seuil par capteur, configurés par l'administrateur :
// - valeur_min / valeur_max     : plage normale. En dehors → alerte
//                                 « avertissement » (visible sur le tableau de bord,
//                                 ferme la vanne), SANS email.
// - critique_min / critique_max : seuils critiques (optionnels), plus larges que
//                                 la plage normale. Au-delà → alerte « critique »
//                                 ET email de notification aux responsables du site.
// Si un seuil critique n'est pas défini d'un côté, le seuil normal de ce côté
// sert aussi de seuil critique (comportement historique : email dès le dépassement).
const seuilSchema = new mongoose.Schema({
  capteur_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Capteur',
    required: true,
    unique: true,
  },
  valeur_min: { type: Number, required: true },
  valeur_max: { type: Number, required: true },
  critique_min: { type: Number, default: null },
  critique_max: { type: Number, default: null },
});

module.exports = mongoose.model('Seuil', seuilSchema);
