const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Site, Capteur, Utilisateur;
let siteTest;
let jetonAdmin;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Site = require('../models/site.model');
  Capteur = require('../models/capteur.model');
  Utilisateur = require('../models/utilisateur.model');
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

beforeEach(async () => {
  siteTest = await Site.create({ nom: 'Site de test' });

  const bcrypt = require('bcryptjs');
  const motDePasseHash = await bcrypt.hash('motdepasse123', 10);
  await Utilisateur.create({ nom: 'Admin', email: 'admin@test.local', motDePasseHash, role: 'administrateur' });

  const connexion = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.local', motDePasse: 'motdepasse123' });
  jetonAdmin = connexion.body.jeton;
});

test("POST /api/capteurs refuse un canal ADC déjà utilisé sur le même site", async () => {
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH', canal_adc: 0 });

  const res = await request(app)
    .post('/api/capteurs')
    .set('Authorization', `Bearer ${jetonAdmin}`)
    .send({ site_id: siteTest._id.toString(), type: 'turbidite', modele: 'Test', unite: 'NTU', canal_adc: 0 });

  expect(res.status).toBe(409);
  expect(res.body.erreur).toMatch(/déjà utilisé/);
});

test("POST /api/capteurs autorise un canal ADC libre", async () => {
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH', canal_adc: 0 });

  const res = await request(app)
    .post('/api/capteurs')
    .set('Authorization', `Bearer ${jetonAdmin}`)
    .send({ site_id: siteTest._id.toString(), type: 'turbidite', modele: 'Test', unite: 'NTU', canal_adc: 1 });

  expect(res.status).toBe(201);
});

test("POST /api/capteurs autorise le même canal sur DEUX sites différents", async () => {
  const autreSite = await Site.create({ nom: 'Autre site' });
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH', canal_adc: 0 });

  const res = await request(app)
    .post('/api/capteurs')
    .set('Authorization', `Bearer ${jetonAdmin}`)
    .send({ site_id: autreSite._id.toString(), type: 'pH', modele: 'Test', unite: 'pH', canal_adc: 0 });

  expect(res.status).toBe(201);
});

test("POST /api/capteurs autorise plusieurs capteurs sans canal ADC (numériques)", async () => {
  await Capteur.create({ site_id: siteTest._id, type: 'temperature', modele: 'Test', unite: '°C', canal_adc: null });

  const res = await request(app)
    .post('/api/capteurs')
    .set('Authorization', `Bearer ${jetonAdmin}`)
    .send({ site_id: siteTest._id.toString(), type: 'humidite', modele: 'Test', unite: '%' });

  expect(res.status).toBe(201);
});
