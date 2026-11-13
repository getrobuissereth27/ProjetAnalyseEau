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

test("un administrateur peut ajouter un responsable ou un autre administrateur sur ses sites, mais pas de superadmin ni sur un autre site", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const autreAdmin = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'X', email: 'x@test.local', motDePasse: 'motdepasse123', role: 'administrateur', sites: [siteA._id] });
  expect(autreAdmin.status).toBe(201);
  expect(autreAdmin.body.role).toBe('administrateur');

  const superadmin = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'S', email: 's@test.local', motDePasse: 'motdepasse123', role: 'superadmin', sites: [siteA._id] });
  expect(superadmin.status).toBe(403);

  const mauvaisSite = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'Y', email: 'y@test.local', motDePasse: 'motdepasse123', sites: [siteB._id] });
  expect(mauvaisSite.status).toBe(403);

  const ok = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'Z', email: 'z@test.local', motDePasse: 'motdepasse123', sites: [siteA._id] });
  expect(ok.status).toBe(201);
  expect(ok.body.role).toBe('communautaire');
});

test("un compte ajouté par un administrateur rejoint automatiquement le site de cet administrateur", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const res = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'Auto', email: 'auto@test.local', motDePasse: 'motdepasse123' }); // aucun site envoyé
  expect(res.status).toBe(201);
  expect((await Utilisateur.findById(res.body._id)).sites.map(String)).toEqual([siteA._id.toString()]);
});

test("un administrateur de plusieurs sites rattache le compte à un seul site, jamais plusieurs", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id, siteB._id]);

  const sansSite = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'A', email: 'a@test.local', motDePasse: 'motdepasse123' });
  expect(sansSite.status).toBe(400);

  const plusieurs = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'B', email: 'b@test.local', motDePasse: 'motdepasse123', sites: [siteA._id, siteB._id] });
  expect(plusieurs.status).toBe(403);

  const unSite = await request(app).post('/api/users').set('Authorization', admin.jeton)
    .send({ nom: 'C', email: 'c@test.local', motDePasse: 'motdepasse123', sites: [siteB._id] });
  expect(unSite.status).toBe(201);
});

test("seul le super administrateur peut attribuer ou retirer des sites à un compte", async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
  const caepa = await compte('caepa@test.local', 'communautaire', [siteA._id]);

  const refus = await request(app).patch(`/api/users/${caepa.u._id}/sites`).set('Authorization', admin.jeton).send({ sites: [siteA._id] });
  expect(refus.status).toBe(403);

  const ok = await request(app).patch(`/api/users/${caepa.u._id}/sites`).set('Authorization', sup.jeton).send({ sites: [siteA._id, siteB._id] });
  expect(ok.status).toBe(200);

  // L'admin ne voit que siteA parmi les sites du responsable, et n'a pas le droit de les modifier
  const liste = await request(app).get('/api/users').set('Authorization', admin.jeton);
  const vu = liste.body.find((u) => u.email === 'caepa@test.local');
  expect(vu.sites).toEqual([siteA._id.toString()]);
  expect(vu.droits.sites).toBe(false);
});

test("un administrateur peut promouvoir un responsable de ses sites en administrateur, jamais en superadmin", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
  const caepa = await compte('caepa@test.local', 'communautaire', [siteA._id]);

  const ok = await request(app).patch(`/api/users/${caepa.u._id}/role`).set('Authorization', admin.jeton).send({ role: 'administrateur' });
  expect(ok.status).toBe(200);
  expect(ok.body.role).toBe('administrateur');

  const refus = await request(app).patch(`/api/users/${caepa.u._id}/role`).set('Authorization', admin.jeton).send({ role: 'superadmin' });
  expect(refus.status).toBe(403);
});

test("un administrateur ne peut ni changer le rôle ni supprimer un compte qui a aussi des sites hors de son périmètre", async () => {
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
  const autreAdmin = await compte('admin2@test.local', 'administrateur', [siteA._id, siteB._id]);

  const role = await request(app).patch(`/api/users/${autreAdmin.u._id}/role`).set('Authorization', admin.jeton).send({ role: 'communautaire' });
  expect(role.status).toBe(403);

  const suppr = await request(app).delete(`/api/users/${autreAdmin.u._id}`).set('Authorization', admin.jeton);
  expect(suppr.status).toBe(403);
});

test("un administrateur ne peut pas toucher à un superadmin", async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);

  const suppr = await request(app).delete(`/api/users/${sup.u._id}`).set('Authorization', admin.jeton);
  expect(suppr.status).toBe(403);
  const modif = await request(app).patch(`/api/users/${sup.u._id}`).set('Authorization', admin.jeton).send({ nom: 'Pirate' });
  expect(modif.status).toBe(403);
});

test('un administrateur sur plusieurs sites, plusieurs administrateurs sur un site', async () => {
  const sup = await compte('sup@test.local', 'superadmin');
  for (const email of ['a1@test.local', 'a2@test.local']) {
    const res = await request(app).post('/api/users').set('Authorization', sup.jeton)
      .send({ nom: email, email, motDePasse: 'motdepasse123', role: 'administrateur', sites: [siteA._id, siteB._id] });
    expect(res.status).toBe(201);
  }
  expect(await Utilisateur.countDocuments({ role: 'administrateur', sites: siteA._id })).toBe(2);
  expect(await Utilisateur.countDocuments({ role: 'administrateur', sites: siteB._id })).toBe(2);
});

test("GET /api/alerts n'expose pas les alertes d'un autre site", async () => {
  const caepa = await compte('caepa@test.local', 'communautaire', [siteA._id]);
  const res = await request(app).get(`/api/alerts?site=${siteB._id}`).set('Authorization', caepa.jeton);
  expect(res.status).toBe(403);
});

describe('suppression en masse des alertes', () => {
  let Alerte;
  beforeAll(() => { Alerte = require('../models/alerte.model'); });

  async function creerAlertes(site, n, statut = 'resolue') {
    await Alerte.insertMany(Array.from({ length: n }, () => ({
      site_id: site._id, categorie: 'seuil', type_alerte: 'Valeur hors seuil', statut,
    })));
  }

  test('« tout » supprime toutes les alertes du site, sur toutes les pages, sans toucher aux autres sites', async () => {
    const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
    await creerAlertes(siteA, 40);
    await creerAlertes(siteB, 5);

    const res = await request(app).delete('/api/alerts').set('Authorization', admin.jeton).send({ tout: true, site: siteA._id });
    expect(res.status).toBe(200);
    expect(res.body.supprimees).toBe(40);
    expect(await Alerte.countDocuments({ site_id: siteB._id })).toBe(5);
  });

  test('« tout » respecte le filtre de statut', async () => {
    const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
    await creerAlertes(siteA, 10, 'resolue');
    await creerAlertes(siteA, 3, 'active');

    const res = await request(app).delete('/api/alerts').set('Authorization', admin.jeton).send({ tout: true, site: siteA._id, statut: 'resolue' });
    expect(res.body.supprimees).toBe(10);
    expect(await Alerte.countDocuments({ site_id: siteA._id, statut: 'active' })).toBe(3);
  });

  test("« tout » est refusé sur un site qui n'est pas le sien", async () => {
    const admin = await compte('admin@test.local', 'administrateur', [siteA._id]);
    await creerAlertes(siteB, 5);
    const res = await request(app).delete('/api/alerts').set('Authorization', admin.jeton).send({ tout: true, site: siteB._id });
    expect(res.status).toBe(403);
    expect(await Alerte.countDocuments({ site_id: siteB._id })).toBe(5);
  });
});
