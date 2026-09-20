const mongoose = require('mongoose');

// Au-delà de ce délai sans nouvelle mesure reçue, un capteur actif est considéré
// défectueux plutôt que simplement "en retard" — configurable via variable
// d'environnement si l'intervalle d'envoi du Raspberry Pi diffère du défaut (10s).
const SEUIL_HEARTBEAT_MS = Number(process.env.SEUIL_HEARTBEAT_MS) || 5 * 60 * 1000; // 5 minutes

const capteurSchema = new mongoose.Schema({
  site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  type: { type: String, required: true, trim: true },       // ex: 'pH', 'turbidite', 'temperature', 'tds'
  modele: { type: String, required: true, trim: true },
  unite: { type: String, required: true, trim: true },
  actif: { type: Boolean, default: true },
  broche: { type: String, trim: true, default: '' }, // ex: "A0", "A1", "D2" — broche Arduino occupée (informatif)
  dernierBattement: { type: Date, default: null },          // mis à jour à chaque mesure reçue (voir mesures.controller.js)
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Statut dérivé du heartbeat — jamais stocké, toujours recalculé à la lecture :
// 'desactive'  : le capteur a été désactivé manuellement (voir capteurs.controller.js)
// 'inconnu'    : aucune mesure jamais reçue pour ce capteur
// 'fonctionne' : une mesure a été reçue il y a moins de SEUIL_HEARTBEAT_MS
// 'defectueux' : plus aucune mesure reçue depuis plus de SEUIL_HEARTBEAT_MS
capteurSchema.virtual('statut').get(function () {
  if (!this.actif) return 'desactive';
  if (!this.dernierBattement) return 'inconnu';
  const ecouleMs = Date.now() - new Date(this.dernierBattement).getTime();
  return ecouleMs <= SEUIL_HEARTBEAT_MS ? 'fonctionne' : 'defectueux';
});

module.exports = mongoose.model('Capteur', capteurSchema);
