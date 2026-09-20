// Initialise la base avec un premier site, ses 4 capteurs, leurs seuils par
// defaut et des comptes de demonstration.
// Usage : npm run seed

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Site = require('../models/site.model');
const Capteur = require('../models/capteur.model');
const Seuil = require('../models/seuil.model');
const Utilisateur = require('../models/utilisateur.model');

const NOM_SITE_DEFAUT = 'Source communautaire — Site 1';

const CAPTEURS = [
  { type: 'temperature', modele: 'DS18B20', unite: '°C', broche: 'D2', seuil: [15, 30] },
  { type: 'pH', modele: 'DFRobot Pro V2', unite: 'pH', broche: 'A2', seuil: [6.5, 8.5] },
  { type: 'turbidite', modele: 'DFRobot SEN0189', unite: 'NTU', broche: 'A0', seuil: [0, 5] },
  { type: 'tds', modele: 'Capteur TDS générique', unite: 'ppm', broche: 'A1', seuil: [50, 400] },
];

const UTILISATEURS = [
  { nom: 'Jean Registre', email: 'caepa@demo.local', motDePasse: 'motdepasse123', role: 'communautaire' },
  { nom: 'Admin Démo', email: 'admin@demo.local', motDePasse: 'motdepasse123', role: 'administrateur' },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB, initialisation en cours...');

  let site = await Site.findOne({ nom: NOM_SITE_DEFAUT });
  if (!site) {
    site = await Site.create({ nom: NOM_SITE_DEFAUT, localisation: '' });
    console.log(`+ Site créé : ${site.nom} (${site._id})`);
  } else {
    console.log(`= Site déjà existant : ${site.nom} (${site._id})`);
  }

  for (const c of CAPTEURS) {
    let capteur = await Capteur.findOne({ type: c.type, site_id: site._id });
    if (!capteur) {
      capteur = await Capteur.create({
        site_id: site._id, type: c.type, modele: c.modele, unite: c.unite, broche: c.broche,
      });
      console.log(`+ Capteur créé : ${c.type} (${capteur._id})`);
    } else {
      console.log(`= Capteur déjà existant : ${c.type} (${capteur._id})`);
    }

    const seuilExistant = await Seuil.findOne({ capteur_id: capteur._id });
    if (!seuilExistant) {
      await Seuil.create({ capteur_id: capteur._id, valeur_min: c.seuil[0], valeur_max: c.seuil[1] });
      console.log(`  + Seuil créé : [${c.seuil[0]}, ${c.seuil[1]}]`);
    }
  }

  console.log('Terminé.');

  console.log('\nComptes de démonstration :');
  for (const u of UTILISATEURS) {
    const existant = await Utilisateur.findOne({ email: u.email });
    if (!existant) {
      const motDePasseHash = await bcrypt.hash(u.motDePasse, 10);
      await Utilisateur.create({ nom: u.nom, email: u.email, motDePasseHash, role: u.role });
      console.log(`+ Créé : ${u.email} / ${u.motDePasse} (${u.role})`);
    } else {
      console.log(`= Déjà existant : ${u.email} (${u.role})`);
    }
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Erreur pendant l\'initialisation :', err);
  process.exit(1);
});
