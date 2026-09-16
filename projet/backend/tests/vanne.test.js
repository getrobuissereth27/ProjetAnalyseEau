const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Site, Capteur, Seuil, Mesure, Alerte;
let siteTest;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Site = require('../models/site.model');
  Capteur = require('../models/capteur.model');
  Seuil = require('../models/seuil.model');
  Mesure = require('../models/mesure.model');
  Alerte = require('../models/alerte.model');
});

beforeEach(async () => {
  siteTest = await Site.create({ nom: 'Site de test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

test('la vanne est ouverte quand aucune mesure n\'est hors seuil', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Seuil.create({ capteur_id: capteur._id, valeur_min: 6.5, valeur_max: 8.5 });

  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 7.2 });

  const res = await request(app).get('/api/vanne/etat');
  expect(res.status).toBe(200);
  expect(res.body.etat).toBe('ouverte');
  expect(res.body.parametresHorsLimite).toHaveLength(0);
});

test('la vanne se ferme dès qu\'une mesure dépasse le seuil', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'turbidite', modele: 'Test', unite: 'NTU' });
  await Seuil.create({ capteur_id: capteur._id, valeur_min: 0, valeur_max: 5 });

  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 8.4 });

  const res = await request(app).get('/api/vanne/etat');
  expect(res.body.etat).toBe('fermee');
  expect(res.body.parametresHorsLimite).toHaveLength(1);
  expect(res.body.parametresHorsLimite[0].type).toBe('turbidite');
});

test('la vanne se rouvre automatiquement quand la mesure suivante revient dans les limites', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Seuil.create({ capteur_id: capteur._id, valeur_min: 6.5, valeur_max: 8.5 });

  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 9.5 }); // hors seuil
  let res = await request(app).get('/api/vanne/etat');
  expect(res.body.etat).toBe('fermee');

  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 7.1 }); // revenu normal
  res = await request(app).get('/api/vanne/etat');
  expect(res.body.etat).toBe('ouverte');
});

test('ne crée pas de doublon d\'alerte si plusieurs mesures consécutives restent hors seuil', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Seuil.create({ capteur_id: capteur._id, valeur_min: 6.5, valeur_max: 8.5 });

  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 9.0 });
  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 9.2 });
  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 9.1 });

  const alertesActives = await Alerte.find({ statut: 'active' });
  expect(alertesActives).toHaveLength(1);
});

test('la vanne reste fermée si un seul des deux paramètres hors seuil revient à la normale', async () => {
  const capteurPH = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const capteurTurb = await Capteur.create({ site_id: siteTest._id, type: 'turbidite', modele: 'Test', unite: 'NTU' });
  await Seuil.create({ capteur_id: capteurPH._id, valeur_min: 6.5, valeur_max: 8.5 });
  await Seuil.create({ capteur_id: capteurTurb._id, valeur_min: 0, valeur_max: 5 });

  await request(app).post('/api/mesures').send({ capteur_id: capteurPH._id.toString(), valeur: 9.5 });
  await request(app).post('/api/mesures').send({ capteur_id: capteurTurb._id.toString(), valeur: 8.0 });

  // le pH revient à la normale, mais la turbidité reste hors seuil
  await request(app).post('/api/mesures').send({ capteur_id: capteurPH._id.toString(), valeur: 7.0 });

  const res = await request(app).get('/api/vanne/etat');
  expect(res.body.etat).toBe('fermee');
  expect(res.body.parametresHorsLimite).toHaveLength(1);
  expect(res.body.parametresHorsLimite[0].type).toBe('turbidite');
});
