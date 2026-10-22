/* M/s Savalia Jaysukh M. — website server
   Serves the public site and a password-protected admin (/admin) where the
   firm can add / edit / delete works in each category, with photographs.
   Data lives in data/works.json; uploaded photos in uploads/.            */
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'works.json');
const ADMIN_FILE = path.join(ROOT, 'data', 'admin.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = process.env.PORT || 8080;

/* ---------- password (hashed, changeable from the admin panel) ---------- */
function hashPassword(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}
function loadAdmin() {
  if (fs.existsSync(ADMIN_FILE)) return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
  const salt = crypto.randomBytes(16).toString('hex');
  const rec = { salt, hash: hashPassword(process.env.ADMIN_PASSWORD || 'Savalia@1997', salt) };
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(rec, null, 1));
  return rec;
}
let admin = loadAdmin();
function passwordOk(pw) {
  const h = Buffer.from(hashPassword(pw || '', admin.salt), 'hex');
  const want = Buffer.from(admin.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

/* ---------- works store ---------- */
function loadWorks() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveWorks(works) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(works, null, 1));
  fs.renameSync(tmp, DATA_FILE);
}
function parseCapNum(capacity) {
  if (!capacity) return 0;
  const m = String(capacity).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = String(capacity).toLowerCase();
  if (u.includes('mld')) n *= 1000;
  else if (u.includes('lakh')) n *= 10;
  else if (u.includes('m3') || u.includes('cum')) n *= 1;
  return n;
}

/* ---------- sessions ---------- */
const sessions = new Map(); // token -> expiry ms
function makeSession(res) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 1000 * 60 * 60 * 12);
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 });
}
function isAuthed(req) {
  const t = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('sid='));
  if (!t) return false;
  const exp = sessions.get(t.slice(4));
  return !!exp && exp > Date.now();
}
function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not signed in' });
  next();
}

/* ---------- uploads ---------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

/* ---------- app ---------- */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/works', (req, res) => {
  const works = loadWorks();
  works.sort((a, b) => (b.capNum || 0) - (a.capNum || 0));
  res.json(works);
});
app.get('/api/works/:id', (req, res) => {
  const w = loadWorks().find(x => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Work not found' });
  res.json(w);
});

app.post('/api/login', (req, res) => {
  if (!passwordOk(req.body.password)) return res.status(401).json({ error: 'Wrong password' });
  makeSession(res);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { res.clearCookie('sid'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req) }));
app.post('/api/password', requireAuth, (req, res) => {
  if (!passwordOk(req.body.current)) return res.status(401).json({ error: 'Current password is wrong' });
  if (!req.body.next || req.body.next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const salt = crypto.randomBytes(16).toString('hex');
  admin = { salt, hash: hashPassword(req.body.next, salt) };
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 1));
  res.json({ ok: true });
});

function workFromBody(body, existing) {
  const w = existing || { id: crypto.randomBytes(6).toString('hex'), image: null };
  const label = (body.categoryLabel || '').trim();
  w.title = (body.title || '').trim();
  w.categoryLabel = label;
  w.categoryKey = (body.categoryKey || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other');
  w.client = (body.client || '').trim();
  w.location = (body.location || '').trim();
  w.capacity = (body.capacity || '').trim();
  w.capNum = parseCapNum(w.capacity);
  w.description = (body.description || '').trim();
  w.featuredNote = (body.featuredNote || '').trim();
  w.year = (body.year || '').trim();
  w.featured = body.featured === 'true' || body.featured === true || body.featured === 'on';
  if (body.removeImage === 'true') w.image = null;
  if (typeof body.imagePath === 'string' && body.imagePath !== '') {
    w.image = body.imagePath === '__none' ? null : body.imagePath;
    w.imageTemp = !!w.image && w.image.includes('/temp/');
  }
  return w;
}

app.post('/api/works', requireAuth, upload.single('image'), (req, res) => {
  if (!req.body.title || !req.body.categoryLabel) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Title and category are required' });
  }
  const w = workFromBody(req.body, null);
  if (req.file) w.image = 'uploads/' + req.file.filename;
  const works = loadWorks();
  works.push(w);
  saveWorks(works);
  res.json(w);
});

app.put('/api/works/:id', requireAuth, upload.single('image'), (req, res) => {
  const works = loadWorks();
  const i = works.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Work not found' });
  const old = works[i];
  const w = workFromBody(req.body, { ...old });
  if (req.file) {
    if (old.image && old.image.startsWith('uploads/')) fs.unlink(path.join(ROOT, old.image), () => {});
    w.image = 'uploads/' + req.file.filename;
  } else if (w.image === null && old.image && old.image.startsWith('uploads/') && req.body.removeImage === 'true') {
    fs.unlink(path.join(ROOT, old.image), () => {});
  }
  works[i] = w;
  saveWorks(works);
  res.json(w);
});

app.delete('/api/works/:id', requireAuth, (req, res) => {
  const works = loadWorks();
  const w = works.find(x => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Work not found' });
  if (w.image && w.image.startsWith('uploads/')) fs.unlink(path.join(ROOT, w.image), () => {});
  saveWorks(works.filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

/* ---------- site content (admin-editable) ---------- */
const SITE_FILE = path.join(ROOT, 'data', 'site.json');
app.get('/api/site', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'))); }
  catch (e) { res.json({}); }
});
app.put('/api/site', requireAuth, (req, res) => {
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8')); } catch (e) {}
  const body = req.body || {};
  for (const k of Object.keys(cur)) {
    if (k === 'clients') {
      if (Array.isArray(body.clients)) cur.clients = body.clients.slice(0, 40).map(x => ({ name: String(x.name || ''), group: String(x.group || ''), note: String(x.note || ''), logo: String(x.logo || '') })).filter(x => x.name);
    } else if (k === 'safetyPoints') {
      if (Array.isArray(body.safetyPoints)) cur.safetyPoints = body.safetyPoints.slice(0, 6).map(x => ({ t: String(x.t || ''), d: String(x.d || '') }));
    } else if (typeof body[k] === 'string') cur[k] = body[k];
  }
  for (const k of Object.keys(body)) if (!(k in cur) && typeof body[k] === 'string') cur[k] = body[k];
  fs.writeFileSync(SITE_FILE, JSON.stringify(cur, null, 1));
  res.json(cur);
});

/* ---------- photo library ---------- */
function listMedia() {
  const out = [];
  const scan = (dir, prefix) => {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return;
    for (const f of fs.readdirSync(full)) {
      if (/\.(jpe?g|png|webp|gif)$/i.test(f)) out.push(prefix + f);
    }
  };
  scan('assets/images', 'assets/images/');
  scan('assets/images/clients', 'assets/images/clients/');
  scan('uploads', 'uploads/');
  return out;
}
app.get('/api/media', (req, res) => res.json(listMedia()));
app.post('/api/media', requireAuth, upload.array('images', 12), (req, res) => {
  res.json({ saved: (req.files || []).map(f => 'uploads/' + f.filename) });
});
app.delete('/api/media', requireAuth, (req, res) => {
  const pth = String(req.query.path || '');
  if (!/^uploads\//.test(pth)) return res.status(400).json({ error: 'That photo is part of the website design and cannot be deleted here.' });
  const full = path.join(ROOT, pth);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  const works = loadWorks();
  let changed = false;
  works.forEach(w => { if (w.image === pth) { w.image = null; w.imageTemp = false; changed = true; } });
  if (changed) saveWorks(works);
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(ROOT, 'admin.html')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(ROOT, { index: 'index.html' }));

app.listen(PORT, () => console.log(`Savalia Construction site running at http://localhost:${PORT}  (admin: /admin)`));
