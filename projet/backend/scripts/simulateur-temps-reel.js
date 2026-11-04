// Simulateur temps réel : fait vivre le tableau de bord comme si le Raspberry Pi
// était branché. À intervalle régulier, il envoie une nouvelle mesure pour chaque
// capteur actif, par l'API (POST /api/measurements), exactement comme le client
// Raspberry Pi. Le heartbeat, les alertes, la vanne et les emails se déclenchent
// donc comme en conditions réelles.
//
// Prérequis : `npm run seed` déjà lancé, capteurs actifs, API démarrée.
//
// Usage :
//   npm run simuler
//   INTERVALLE_SECONDES=5 npm run simuler
//   PROBABILITE_INCIDENT=0.02 npm run simuler     (plus d'incidents)
// Arrêt : Ctrl+C

require('dotenv').config();
const mongoose = require('mongoose');
const Capteur = require('../models/capteur.model');
const Seuil = require('../models/seuil.model');
const Mesure = require('../models/mesure.model');

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const INTERVALLE_SECONDES = Number(process.env.INTERVALLE_SECONDES || 10);
// Probabilité, à chaque envoi, qu'un capteur commence un incident hors seuil.
const PROBABILITE_INCIDENT = Number(process.env.PROBABILITE_INCIDENT || 0.004);

const PLAGES_NORMALES = {
  pH: { min: 6.8, max: 8.2, pas: 0.5 },
  turbidite: { min: 0.5, max: 3.0, pas: 0.15 },
  tds: { min: 100, max: 300, pas: 6 },
  temperature: { min: 22, max: 27, pas: 5 },
};
const AMPLEUR_INCIDENT = { pH: 1.3, turbidite: 8, tds: 200, temperature: 6 };

function alea(min, max) {
  return min + Math.random() * (max - min);
}

// Calcule la prochaine valeur d'un capteur à partir de son état courant.
// État : { valeur, incident: null | { cible, restant } }
function prochaineValeur(etat, plage, seuil, ampleur) {
  const centre = (plage.min + plage.max) / 2;

  // Début d'un incident : le capteur part vers une valeur hors seuil pendant
  // quelques envois, puis revient (ce qui résout l'alerte automatiquement).
  if (!etat.incident && seuil && Math.random() < PROBABILITE_INCIDENT) {
    const auDessus = Math.random() > 0.5;
    etat.incident = {
      cible: auDessus ? seuil.valeur_max + alea(0.1, ampleur) : seuil.valeur_min - alea(0.1, ampleur),
      restant: Math.round(alea(4, 10)),
    };
  }

  if (etat.incident) {
    // On se rapproche rapidement de la cible, avec un peu de bruit.
    etat.valeur += (etat.incident.cible - etat.valeur) * 0.6 + alea(-plage.pas, plage.pas);
    etat.incident.restant -= 1;
    if (etat.incident.restant <= 0) etat.incident = null;
  } else {
    // Marche aléatoire qui revient doucement vers le centre de la plage normale.
    etat.valeur += alea(-plage.pas, plage.pas) + (centre - etat.valeur) * 0.08;
    etat.valeur = Math.min(plage.max, Math.max(plage.min, etat.valeur));
  }
  return Math.round(etat.valeur * 100) / 100;
}

async function envoyer(capteurId, valeur) {
  const res = await fetch(`${API_URL}/api/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capteur_id: capteurId, valeur }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const capteurs = await Capteur.find({ actif: { $ne: false } });
  if (capteurs.length === 0) {
    console.log("Aucun capteur actif. Lance `npm run seed` et active les capteurs dans Paramètres.");
    await mongoose.disconnect();
    return;
  }

  // Chaque capteur repart de sa dernière valeur connue : la courbe continue
  // sans saut avec l'historique déjà généré.
  const suivis = [];
  for (const capteur of capteurs) {
    const plage = PLAGES_NORMALES[capteur.type] || { min: 0, max: 100, pas: 2 };
    const seuil = await Seuil.findOne({ capteur_id: capteur._id });
    const derniere = await Mesure.findOne({ capteur_id: capteur._id }).sort({ horodatage: -1 });
    const depart = derniere ? derniere.valeur : (plage.min + plage.max) / 2;
    suivis.push({
      capteur, plage, seuil,
      ampleur: AMPLEUR_INCIDENT[capteur.type] || 10,
      etat: { valeur: depart, incident: null },
    });
  }
  await mongoose.disconnect();

  console.log(`Simulation lancée : ${suivis.length} capteur(s), une mesure toutes les ${INTERVALLE_SECONDES} s, vers ${API_URL}`);
  console.log('Ctrl+C pour arrêter.\n');

  const cycle = async () => {
    const heure = new Date().toLocaleTimeString('fr-FR');
    const lignes = [];
    for (const s of suivis) {
      const valeur = prochaineValeur(s.etat, s.plage, s.seuil, s.ampleur);
      try {
        await envoyer(s.capteur._id, valeur);
        lignes.push(`${s.capteur.type}=${valeur}${s.etat.incident ? '*' : ''}`);
      } catch (err) {
        lignes.push(`${s.capteur.type}=ERREUR(${err.message})`);
      }
    }
    console.log(`[${heure}] ${lignes.join('  ')}`);
  };

  await cycle();
  setInterval(cycle, INTERVALLE_SECONDES * 1000);
}

run().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});