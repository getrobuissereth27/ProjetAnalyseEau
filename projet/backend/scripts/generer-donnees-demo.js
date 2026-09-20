// Génère un historique de mesures simulées, réparties sur plusieurs jours, pour
// pouvoir visualiser immédiatement les graphiques, le tableau d'historique et
// les alertes sans attendre que le client Raspberry Pi (ou son mode simulation)
// tourne pendant des heures.
//
// Prérequis : avoir déjà lancé `npm run seed` au moins une fois (les sites,
// capteurs et seuils doivent exister).
//
// Usage :
//   npm run donnees:demo
//   JOURS_HISTORIQUE=14 INTERVALLE_MINUTES=5 npm run donnees:demo
//   REINITIALISER=true npm run donnees:demo   (efface l'historique existant avant de regénérer)

require('dotenv').config();
const mongoose = require('mongoose');
const Site = require('../models/site.model');
const Capteur = require('../models/capteur.model');
const Seuil = require('../models/seuil.model');
const Mesure = require('../models/mesure.model');
const Alerte = require('../models/alerte.model');

const JOURS_HISTORIQUE = Number(process.env.JOURS_HISTORIQUE || 7);
const INTERVALLE_MINUTES = Number(process.env.INTERVALLE_MINUTES || 10);
const REINITIALISER = process.env.REINITIALISER === 'true';

// Plage "normale" par type de capteur — resserrée à l'intérieur du seuil pour
// que la plupart des points soient sains, avec de temps en temps un incident
// (voir injecterIncidents) qui sort volontairement de cette plage.
const PLAGES_NORMALES = {
  pH: { min: 6.8, max: 8.2, pas: 0.15 },
  turbidite: { min: 0.5, max: 3.0, pas: 0.4 },
  tds: { min: 100, max: 300, pas: 15 },
  temperature: { min: 22, max: 27, pas: 0.3 },
};

// Amplitude de l'excursion hors seuil pendant un incident simulé, par type.
const AMPLEUR_INCIDENT = {
  pH: 1.3,
  turbidite: 8,
  tds: 200,
  temperature: 6,
};

function alea(min, max) {
  return min + Math.random() * (max - min);
}

// Marche aléatoire simple : chaque point dérive un peu du précédent plutôt que
// d'être totalement indépendant, pour un rendu de courbe réaliste.
function genererSerieBase(nbPoints, plage) {
  const serie = [];
  let valeur = alea(plage.min, plage.max);
  for (let i = 0; i < nbPoints; i++) {
    valeur += alea(-plage.pas, plage.pas);
    valeur = Math.min(plage.max, Math.max(plage.min, valeur));
    serie.push(valeur);
  }
  return serie;
}

// Insère, avec une faible probabilité, des épisodes de quelques points
// consécutifs hors seuil — de quoi peupler la page Alertes avec un mélange
// réaliste d'alertes résolues et (pour l'épisode le plus récent, parfois)
// une alerte encore active.
function injecterIncidents(serie, seuil, ampleur) {
  const PROBABILITE_INCIDENT_PAR_JOUR = 0.35;
  const nbJours = Math.ceil(serie.length / (24 * (60 / INTERVALLE_MINUTES)));
  const nbIncidents = Math.round(nbJours * PROBABILITE_INCIDENT_PAR_JOUR * Math.random());

  for (let i = 0; i < nbIncidents; i++) {
    const duree = Math.round(alea(2, 6)); // nombre de points consécutifs hors seuil
    const debut = Math.floor(alea(0, Math.max(1, serie.length - duree)));
    const auDessus = Math.random() > 0.5;

    for (let j = debut; j < Math.min(serie.length, debut + duree); j++) {
      serie[j] = auDessus
        ? seuil.valeur_max + alea(0.1, ampleur)
        : seuil.valeur_min - alea(0.1, ampleur);
    }
  }
  return serie;
}

// Reconstitue, après coup, les épisodes d'alerte à partir d'une série de
// mesures déjà insérées (avec leur _id) — un épisode = une série de points
// consécutifs hors seuil, comme le ferait le service d'analyse en temps réel.
function detecterEpisodes(mesuresInserees, seuil) {
  const episodes = [];
  let episodeEnCours = null;

  mesuresInserees.forEach((m) => {
    const horsSeuil = m.valeur < seuil.valeur_min || m.valeur > seuil.valeur_max;
    if (horsSeuil && !episodeEnCours) {
      episodeEnCours = { mesure_id: m._id, horodatage: m.horodatage };
    } else if (!horsSeuil && episodeEnCours) {
      episodes.push({ ...episodeEnCours, statut: 'resolue', dateResolution: m.horodatage });
      episodeEnCours = null;
    }
  });

  // Si la série se termine en plein incident, l'alerte reste active — c'est
  // exactement ce que ferait le système en conditions réelles.
  if (episodeEnCours) {
    episodes.push({ ...episodeEnCours, statut: 'active', dateResolution: null });
  }
  return episodes;
}

async function genererPourCapteur(capteur, seuil, maintenant) {
  const nbPoints = Math.round((JOURS_HISTORIQUE * 24 * 60) / INTERVALLE_MINUTES);
  const plage = PLAGES_NORMALES[capteur.type] || { min: 0, max: 100, pas: 5 };
  const ampleur = AMPLEUR_INCIDENT[capteur.type] || 10;

  let serie = genererSerieBase(nbPoints, plage);
  if (seuil) serie = injecterIncidents(serie, seuil, ampleur);

  const documents = serie.map((valeur, i) => ({
    capteur_id: capteur._id,
    valeur: Math.round(valeur * 100) / 100,
    // Le plus ancien point est il y a JOURS_HISTORIQUE jours, le dernier est "maintenant"
    horodatage: new Date(maintenant.getTime() - (nbPoints - 1 - i) * INTERVALLE_MINUTES * 60 * 1000),
  }));

  const inserees = await Mesure.insertMany(documents);

  // Heartbeat à jour : le dernier point simulé correspond à "maintenant"
  await Capteur.findByIdAndUpdate(capteur._id, { dernierBattement: inserees[inserees.length - 1].horodatage });

  if (seuil) {
    const episodes = detecterEpisodes(inserees, seuil);
    if (episodes.length > 0) {
      await Alerte.insertMany(episodes.map((e) => ({ ...e, type_alerte: 'Valeur hors seuil' })));
    }
    return { nbMesures: inserees.length, nbAlertes: episodes.length };
  }
  return { nbMesures: inserees.length, nbAlertes: 0 };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB.');

  const sites = await Site.find();
  if (sites.length === 0) {
    console.log("Aucun site trouvé — lance d'abord `npm run seed`.");
    await mongoose.disconnect();
    return;
  }

  const maintenant = new Date();
  console.log(`Génération de ${JOURS_HISTORIQUE} jour(s) d'historique, un point toutes les ${INTERVALLE_MINUTES} min...\n`);

  for (const site of sites) {
    const capteurs = await Capteur.find({ site_id: site._id, actif: true });
    if (capteurs.length === 0) {
      console.log(`= ${site.nom} : aucun capteur actif, ignoré.`);
      continue;
    }

    console.log(`▸ ${site.nom}`);
    for (const capteur of capteurs) {
      const seuil = await Seuil.findOne({ capteur_id: capteur._id });

      if (REINITIALISER) {
        const mesuresAEffacer = await Mesure.find({ capteur_id: capteur._id }).select('_id');
        const idsMesures = mesuresAEffacer.map((m) => m._id);
        await Alerte.deleteMany({ mesure_id: { $in: idsMesures } });
        await Mesure.deleteMany({ capteur_id: capteur._id });
      }

      const { nbMesures, nbAlertes } = await genererPourCapteur(capteur, seuil, maintenant);
      console.log(`  + ${capteur.type} : ${nbMesures} mesures, ${nbAlertes} alerte(s) générée(s)`);
    }
  }

  console.log('\nTerminé — rafraîchis le tableau de bord pour voir les données.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Erreur pendant la génération :', err);
  process.exit(1);
});
