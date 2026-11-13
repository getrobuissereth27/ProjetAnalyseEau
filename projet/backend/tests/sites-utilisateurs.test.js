const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Utilisateur, Site, Capteur;
let siteA, siteB;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Utilisateur = require('../models/utilisateur.model');
  Site = require('../models/site.model');
  Capteur = require('../models/capteur.model');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  siteA = await Site.create({ nom: 'Site A' });
  siteB = await Site.create({ nom: 'Site B' });
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

async function compte(email, role, sites = []) {
  const motDePasseHash = await bcrypt.hash('motdepasse123', 4);
  const u = await Utilisateur.create({ nom: email, email, motDePasseHash, role, sites });
  const res = await request(app).post('/api/auth/login').send({ email, motDePasse: 'motdepasse123' });
  return { u, jeton: `Bearer ${res.body.jeton}` };
}

test('GET /api/sites : le superadmin voit tous les sites, un administrateur seulement les siens', async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const resSup = await request(app).get('/api/sites').set('Authorization', sup.jeton);
  expect(resSup.body).toHaveLength(2);

  const resAdmin = await request(app).get('/api/sites').set('Authorization', admin.jeton);
  expect(resAdmin.body.map((s) => s.nom)).toEqual(['Site A']);
});

test('POST /api/sites : réservé au superadmin', async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const refus = await request(app).post('/api/sites').set('Authorization', admin.jeton).send({ nom: 'Nouveau' });
  expect(refus.status).toBe(403);

  const ok = await request(app).post('/api/sites').set('Authorization', sup.jeton).send({ nom: 'Nouveau' });
  expect(ok.status).toBe(201);
});

test('le superadmin attribue des sites à un administrateur (plusieurs sites par utilisateur)', async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const res = await request(app)
    .patch(`/api/users/${admin.u._id}/sites`)
    .set('Authorization', sup.jeton)
    .send({ sites: [siteA._id, siteB._id] });
  expect(res.status).toBe(200);
  expect(res.body.sites).toHaveLength(2);

  // L'attribution s'applique immédiatement, sans reconnexion
  const sites = await request(app).get('/api/sites').set('Authorization', admin.jeton);
  expect(sites.body).toHaveLength(2);
});

test('un site peut avoir plusieurs utilisateurs', async () => {
  await compte('admin1@test.local', 'administrateur', [siteA._id]);
  await compte('admin2@test.local', 'administrateur', [siteA._id, siteB._id]);
  await compte('caepa@test.local', 'communautaire', [siteA._id]);

  expect(await Utilisateur.countDocuments({ sites: siteA._id })).toBe(3);
});

test("un administrateur ne peut pas modifier les capteurs d'un site qui ne lui est pas attribué", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
  const capteurB = await Capteur.create({ site_id: siteB._id, type: 'pH', modele: 'T', unite: 'pH' });

  const seuil = await request(app)
    .put(`/api/thresholds/${capteurB._id}`)
    .set('Authorization', admin.jeton)
    .send({ valeur_min: 6, valeur_max: 8 });
  expect(seuil.status).toBe(403);

  const creation = await request(app)
    .post('/api/sensors')
    .set('Authorization', admin.jeton)
    .send({ site_id: siteB._id, type: 'pH', modele: 'T', unite: 'pH' });
  expect(creation.status).toBe(403);
});

test("un administrateur ne peut pas créer d'administrateur ni attribuer un site qui n'est pas le sien", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const autreAdmin = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'X', email: 'x@test.local', motDePasse: 'motdepasse123', role: 'administrateur', sites: [siteA._id] });
  expect(autreAdmin.status).toBe(403);

  const mauvaisSite = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'Y', email: 'y@test.local', motDePasse: 'motdepasse123', sites: [siteB._id] });
  expect(mauvaisSite.status).toBe(403);

  const ok = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'Z', email: 'z@test.local', motDePasse: 'motdepasse123', sites: [siteA._id] });
  expect(ok.status).toBe(201);
  expect(ok.body.role).toBe('communautaire');
});

test("un administrateur qui modifie les sites d'un responsable conserve ceux qui sont hors de son périmètre", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
  const caepa = await compte('caepa@test.local', 'communautaire', [siteA._id, siteB._id]);

  // L'admin ne voit que siteA dans la liste des sites du responsable
  const liste = await request(app).get('/api/users').set('Authorization', admin.jeton);
  const vu = liste.body.find((u) => u.email === 'caepa@test.local');
  expect(vu.sites).toEqual([siteA._id.toString()]);

  // Il retire siteA → il reste siteB (hors de son périmètre)
  const res = await request(app).patch(`/api/users/${caepa.u._id}/sites`).set('Authorization', admin.jeton).send({ sites: [] });
  expect(res.status).toBe(200);
  const enBase = await Utilisateur.findById(caepa.u._id);
  expect(enBase.sites.map(String)).toEqual([siteB._id.toString()]);
});

test('changer un rôle est réservé au superadmin', async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
  const caepa = await compte('caepa@test.local', 'communautaire', [siteA._id]);

  const refus = await request(app).patch(`/api/users/${caepa.u._id}/role`).set('Authorization', admin.jeton).send({ role: 'administrateur' });
  expect(refus.status).toBe(403);

  const ok = await request(app).patch(`/api/users/${caepa.u._id}/role`).set('Authorization', sup.jeton).send({ role: 'administrateur' });
  expect(ok.status).toBe(200);
  expect(ok.body.role).toBe('administrateur');
});

test("GET /api/alerts n'expose pas les alertes d'un autre site", async () => {
  const caepa = await compte('caepa@test.local', 'communautaire', [siteA._id]);
  const res = await request(app).get(`/api/alerts?site=${siteB._id}`).set('Authorization', caepa.jeton);
  expect(res.status).toBe(403);
});
