const mongoose = require('mongoose');

// Délai par défaut (en secondes) sans nouvelle mesure au-delà duquel un capteur
// actif est déclaré défectueux. Chaque capteur peut avoir son propre délai,
// configuré par l'administrateur (page Paramètres) — voir delaiDefaillanceSecondes.
const DELAI_DEFAILLANCE_DEFAUT_S = Number(process.env.DELAI_DEFAILLANCE_DEFAUT_S)
  || Math.round((Number(process.env.SEUIL_HEARTBEAT_MS) || 5 * 60 * 1000) / 1000); // 5 minutes
const DELAI_DEFAILLANCE_MIN_S = 10;

const capteurSchema = new mongoose.Schema({
  site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  type: { type: String, required: true, trim: true },       // ex: 'pH', 'turbidite', 'temperature', 'tds'
  modele: { type: String, required: true, trim: true },
  unite: { type: String, required: true, trim: true },
  actif: { type: Boolean, default: true },
  broche: { type: String, trim: true, default: '' }, // ex: "A0", "A1", "D2" — broche Arduino occupée (informatif)
  dernierBattement: { type: Date, default: null },          // mis à jour à chaque mesure reçue (voir mesures.controller.js)
  delaiDefaillanceSecondes: {
    type: Number,
    default: DELAI_DEFAILLANCE_DEFAUT_S,
    min: DELAI_DEFAILLANCE_MIN_S,
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

capteurSchema.methods.delaiDefaillanceMs = function () {
  return (this.delaiDefaillanceSecondes || DELAI_DEFAILLANCE_DEFAUT_S) * 1000;
};

// Statut dérivé du heartbeat — jamais stocké, toujours recalculé à la lecture :
// 'desactive'  : le capteur a été désactivé manuellement (voir capteurs.controller.js)
// 'inconnu'    : aucune mesure jamais reçue pour ce capteur
// 'fonctionne' : une mesure a été reçue il y a moins de delaiDefaillanceSecondes
// 'defectueux' : plus aucune mesure reçue depuis plus de delaiDefaillanceSecondes
capteurSchema.virtual('statut').get(function () {
  if (!this.actif) return 'desactive';
  if (!this.dernierBattement) return 'inconnu';
  const ecouleMs = Date.now() - new Date(this.dernierBattement).getTime();
  return ecouleMs <= this.delaiDefaillanceMs() ? 'fonctionne' : 'defectueux';
});

module.exports = mongoose.model('Capteur', capteurSchema);
module.exports.DELAI_DEFAILLANCE_DEFAUT_S = DELAI_DEFAILLANCE_DEFAUT_S;
module.exports.DELAI_DEFAILLANCE_MIN_S = DELAI_DEFAILLANCE_MIN_S;
