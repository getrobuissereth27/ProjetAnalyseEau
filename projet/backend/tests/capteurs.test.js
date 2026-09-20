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

test("POST /api/capteurs crée un capteur avec succès", async () => {
  const res = await request(app)
    .post('/api/capteurs')
    .set('Authorization', `Bearer ${jetonAdmin}`)
    .send({ site_id: siteTest._id.toString(), type: 'pH', modele: 'Test', unite: 'pH' });

  expect(res.status).toBe(201);
  expect(res.body.type).toBe('pH');
});

test("POST /api/capteurs refuse une requête avec un champ requis manquant", async () => {
  const res = await request(app)
    .post('/api/capteurs')
    .set('Authorization', `Bearer ${jetonAdmin}`)
    .send({ site_id: siteTest._id.toString(), type: 'pH' }); // modele et unite manquants

  expect(res.status).toBe(400);
});

test("POST /api/capteurs refuse une requête sans jeton d'administrateur", async () => {
  const res = await request(app)
    .post('/api/capteurs')
    .send({ site_id: siteTest._id.toString(), type: 'pH', modele: 'Test', unite: 'pH' });

  expect(res.status).toBe(401);
});

test("GET /api/capteurs?site=... ne retourne que les capteurs de ce site", async () => {
  const autreSite = await Site.create({ nom: 'Autre site' });
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Capteur.create({ site_id: autreSite._id, type: 'turbidite', modele: 'Test', unite: 'NTU' });

  const res = await request(app).get(`/api/capteurs?site=${siteTest._id}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].type).toBe('pH');
});
