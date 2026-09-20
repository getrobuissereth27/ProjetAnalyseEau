const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Capteur;
let Site;
let siteTest;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Capteur = require('../models/capteur.model');
  Site = require('../models/site.model');
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
});

test("GET /api/sante répond ok", async () => {
  const res = await request(app).get('/api/sante');
  expect(res.status).toBe(200);
  expect(res.body.statut).toBe('ok');
});

test("POST /api/mesures refuse une requête sans capteur_id", async () => {
  const res = await request(app).post('/api/mesures').send({ valeur: 7.2 });
  expect(res.status).toBe(400);
});

test("POST /api/mesures enregistre une mesure valide", async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });

  const res = await request(app)
    .post('/api/mesures')
    .send({ capteur_id: capteur._id.toString(), valeur: 7.2 });

  expect(res.status).toBe(201);
  expect(res.body.valeur).toBe(7.2);
});

test("GET /api/mesures/dernieres renvoie la dernière valeur par capteur", async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'temperature', modele: 'Test', unite: '°C' });
  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 24 });
  await request(app).post('/api/mesures').send({ capteur_id: capteur._id.toString(), valeur: 25.5 });

  const res = await request(app).get('/api/mesures/dernieres');

  expect(res.status).toBe(200);
  expect(res.body[0].valeur).toBe(25.5);
});

test("GET /api/mesures/dernieres?site=<id> ne renvoie que les capteurs de ce site", async () => {
  const autreSite = await Site.create({ nom: 'Autre site' });
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Capteur.create({ site_id: autreSite._id, type: 'pH', modele: 'Test', unite: 'pH' });

  const res = await request(app).get(`/api/mesures/dernieres?site=${siteTest._id}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});
