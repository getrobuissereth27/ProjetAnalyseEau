const mongoose = require('mongoose');

// categorie :
// - 'seuil'              : une mesure est sortie de la plage autorisée (ferme la vanne)
// - 'capteur_defaillant' : le capteur n'envoie plus de mesure depuis plus de son
//                          délai de défaillance (n'agit pas sur la vanne)
// niveau :
// - 'avertissement' : hors plage normale, pas d'email
// - 'critique'      : seuil critique dépassé (ou capteur défaillant) → email envoyé
const alerteSchema = new mongoose.Schema({
  mesure_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Mesure', default: null },
  capteur_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Capteur', default: null },
  site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
  categorie: { type: String, enum: ['seuil', 'capteur_defaillant'], default: 'seuil' },
  niveau: { type: String, enum: ['avertissement', 'critique'], default: 'critique' },
  type_alerte: { type: String, required: true },
  statut: { type: String, enum: ['active', 'resolue'], default: 'active' },
  emailEnvoye: { type: Boolean, default: false },
  horodatage: { type: Date, default: Date.now },
  dateResolution: { type: Date, default: null },
});

alerteSchema.index({ statut: 1, horodatage: -1 });
alerteSchema.index({ capteur_id: 1, categorie: 1, statut: 1 });
alerteSchema.index({ site_id: 1, horodatage: -1 });

module.exports = mongoose.model('Alerte', alerteSchema);
