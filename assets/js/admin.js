/* Admin panel — talks to the server API only. Plain-language UI for a non-technical editor. */
const $ = s => document.querySelector(s);
let works = [];
let media = [];
let filter = 'all';

const CAT_ORDER = ['water', 'drainage', 'road', 'pipeline', 'building'];
const catLabel = k => (works.find(w => w.categoryKey === k) || {}).categoryLabel || k;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.hidden = true; }, 3400);
}

async function api(url, opts) {
  const r = await fetch(url, opts);
  if (r.status === 401 && !url.endsWith('/api/login')) { showLogin(); throw new Error('signed out'); }
  return r;
}
function showLogin() { $('#loginView').hidden = false; $('#dashView').hidden = true; }
function showDash() { $('#loginView').hidden = true; $('#dashView').hidden = false; }

async function init() {
  const me = await (await fetch('/api/me')).json();
  if (!me.authed) { showLogin(); return; }
  showDash(); await loadAll();
}
async function loadAll() {
  works = await (await api('/api/works')).json();
  media = await (await api('/api/media')).json();
  renderWorks(); renderMedia(); buildPicker();
}

/* ---------- tabs ---------- */
document.querySelectorAll('.atab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.atab').forEach(x => x.classList.toggle('on', x === b));
  ['works', 'content', 'photos'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.tab; });
  if (b.dataset.tab === 'content') loadSiteForm();
}));

/* ---------- works ---------- */
function groups() {
  const map = new Map();
  works.forEach(w => { if (!map.has(w.categoryKey)) map.set(w.categoryKey, []); map.get(w.categoryKey).push(w); });
  const keys = [...map.keys()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return keys.map(k => ({ key: k, label: catLabel(k), list: map.get(k) }));
}

function renderWorks() {
  const g = groups();
  $('#statsLine').textContent = `${works.length} works · ${g.length} categories · ${works.filter(w => w.featured).length} featured on homepage · ${works.filter(w => w.imageTemp).length} with a temporary photo`;
  $('#catTabs').innerHTML =
    `<button class="tab ${filter === 'all' ? 'on' : ''}" data-f="all">All (${works.length})</button>` +
    g.map(x => `<button class="tab ${filter === x.key ? 'on' : ''}" data-f="${x.key}">${x.label} (${x.list.length})</button>`).join('');
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => { filter = b.dataset.f; renderWorks(); });

  const shown = filter === 'all' ? g : g.filter(x => x.key === filter);
  $('#worksList').innerHTML = shown.map(x => `
    <section class="cat-group">
      <h3>${x.label} <span>${x.list.length} works</span></h3>
      ${x.list.map(w => `
        <div class="work-row">
          ${w.image ? `<img class="thumb" src="${w.image}" alt="">` : `<div class="thumb empty">No photo</div>`}
          <div class="wr-main">
            <div class="wr-title">${w.title}</div>
            <div class="wr-meta">${[w.client, w.location, w.capacity, w.year].filter(Boolean).join(' · ') || '—'}</div>
          </div>
          
          ${w.featured ? '<span class="badge">Featured</span>' : ''}
          <button class="btn small" data-edit="${w.id}">Edit</button>
          <button class="btn small danger" data-del="${w.id}">Delete</button>
        </div>`).join('')}
    </section>`).join('') || '<p class="empty-note">No works yet in this category. Use “Add a work”.</p>';

  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(works.find(w => w.id === b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const w = works.find(x => x.id === b.dataset.del);
    if (!confirm(`Delete “${w.title}” from the website? This cannot be undone.`)) return;
    await api('/api/works/' + w.id, { method: 'DELETE' });
    toast('Work deleted.');
    await loadAll();
  });
}

/* ---------- work form ---------- */
function buildPicker() {
  const sel = $('#f_image_pick');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Choose a photo from the library…</option>' +
    '<option value="__none">— No photograph —</option>' +
    media.map(m => `<option value="${m}">${m.split('/').pop()}</option>`).join('');
  if (cur) sel.value = cur;
}
function openForm(w) {
  $('#workForm').reset();
  buildPicker();
  $('#f_preview').hidden = true;
  $('#formErr').textContent = '';
  $('#newCatWrap').hidden = true;
  $('#formTitle').textContent = w ? 'Edit work' : 'Add a work';
  $('#f_id').value = w ? w.id : '';
  if (w) {
    $('#f_title').value = w.title || '';
    const sel = $('#f_category');
    if ([...sel.options].some(o => o.value === w.categoryKey)) sel.value = w.categoryKey;
    else { sel.value = '__new'; $('#newCatWrap').hidden = false; $('#f_newcat').value = w.categoryLabel; }
    $('#f_client').value = w.client || '';
    $('#f_location').value = w.location || '';
    $('#f_capacity').value = w.capacity || '';
    $('#f_year').value = w.year || '';
    $('#f_description').value = w.description || '';
    $('#f_featured').checked = !!w.featured;
    $('#f_featurednote').value = w.featuredNote || '';
    $('#featNoteWrap').hidden = !w.featured;
    if (w.image) {
      $('#f_image_pick').value = w.image;
      const p = $('#f_preview'); p.src = w.image; p.hidden = false;
    }
  } else {
    $('#featNoteWrap').hidden = true;
  }
  $('#formModal').hidden = false;
}
function closeForm() { $('#formModal').hidden = true; }

$('#f_category').addEventListener('change', e => { $('#newCatWrap').hidden = e.target.value !== '__new'; });
$('#f_featured').addEventListener('change', e => { $('#featNoteWrap').hidden = !e.target.checked; });
$('#f_image_pick').addEventListener('change', e => {
  const v = e.target.value, p = $('#f_preview');
  if (v && v !== '__none') { p.src = v; p.hidden = false; } else p.hidden = true;
});
$('#f_image').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) { const p = $('#f_preview'); p.src = URL.createObjectURL(f); p.hidden = false; }
});
$('#addBtn').onclick = () => openForm(null);
$('#formClose').onclick = closeForm;
$('#formCancel').onclick = closeForm;

$('#workForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('#f_id').value;
  const fd = new FormData();
  const sel = $('#f_category').value;
  fd.append('title', $('#f_title').value);
  if (sel === '__new') { fd.append('categoryLabel', $('#f_newcat').value); fd.append('categoryKey', ''); }
  else { fd.append('categoryKey', sel); fd.append('categoryLabel', catLabel(sel) || sel); }
  fd.append('client', $('#f_client').value);
  fd.append('location', $('#f_location').value);
  fd.append('capacity', $('#f_capacity').value);
  fd.append('year', $('#f_year').value);
  fd.append('description', $('#f_description').value);
  fd.append('featuredNote', $('#f_featurednote').value);
  fd.append('featured', $('#f_featured').checked ? 'true' : 'false');
  fd.append('removeImage', $('#f_removeimg').checked ? 'true' : 'false');
  const img = $('#f_image').files[0];
  if (img) fd.append('image', img);
  else fd.append('imagePath', $('#f_image_pick').value);
  $('#formSave').disabled = true;
  const r = await api(id ? '/api/works/' + id : '/api/works', { method: id ? 'PUT' : 'POST', body: fd });
  $('#formSave').disabled = false;
  if (!r.ok) { $('#formErr').textContent = (await r.json()).error || 'Could not save — please try again.'; return; }
  closeForm();
  toast(id ? 'Work updated — the website now shows the change.' : 'Work added — it is now on the website.');
  await loadAll();
});

/* ---------- website text & details ---------- */
const SITE_GROUPS = [
  ['Firm details — shown on every page', [
    ['firmName', 'Firm name', 'text'], ['firmSub', 'Line under the name', 'text'], ['motto', 'Motto (footer headline)', 'text'],
    ['phone', 'Phone number', 'text'], ['email', 'Email address', 'text'],
    ['addressShort', 'Short address (top bar)', 'text'], ['addressFull', 'Full address', 'textarea'],
    ['hours', 'Working hours', 'text'], ['footerBlurb', 'Short “about the firm” line in the footer', 'textarea'],
  ]],
  ['Homepage', [
    ['heroImage', 'Main photo at the top (homepage banner)', 'image'], ['heroHeadline', 'Headline over the main photo', 'text'],
    ['heroCaption', 'Caption under the main photo', 'text'],
    ['homeIntroHeading', 'Introduction heading', 'text'], ['homeIntro1', 'Introduction — first paragraph', 'textarea'],
    ['homeIntro2', 'Introduction — second paragraph', 'textarea'],
    ['safetyHeading', 'Safety heading', 'text'], ['safetyText', 'Safety paragraph', 'textarea'],
    ['sp1t', 'Safety point 1 — title', 'text'], ['sp1d', 'Safety point 1 — line', 'text'],
    ['sp2t', 'Safety point 2 — title', 'text'], ['sp2d', 'Safety point 2 — line', 'text'],
    ['sp3t', 'Safety point 3 — title', 'text'], ['sp3d', 'Safety point 3 — line', 'text'],
  ]],
  ['About page', [
    ['aboutHeading', 'Heading', 'text'], ['aboutPara1', 'Paragraph 1', 'textarea'], ['aboutPara2', 'Paragraph 2', 'textarea'], ['aboutPara3', 'Paragraph 3', 'textarea'],
    ['servicesHeading', 'Services heading', 'text'], ['servicesText1', 'Services — paragraph 1', 'textarea'], ['servicesText2', 'Services — paragraph 2', 'textarea'],
    ['aboutSafetyHeading', 'Safety heading', 'text'], ['aboutSafetyText', 'Safety paragraph', 'textarea'],
  ]],
  ['Clients & Contact pages', [
    ['clientsIntro', 'Clients page — introduction', 'textarea'], ['contactIntro', 'Contact page — introduction', 'textarea'],
  ]],
];
let siteLoaded = false;
async function loadSiteForm() {
  if (siteLoaded) return;
  const site = await (await api('/api/site')).json();
  const form = $('#siteForm');
  form.innerHTML = SITE_GROUPS.map(([gname, fields]) => `
    <fieldset class="site-group"><legend>${gname}</legend>
    ${fields.map(([key, label, type]) => {
      let val = site[key] || '';
      if (key.startsWith('sp')) {
        const pt = (site.safetyPoints || [])[Number(key[2]) - 1] || {};
        val = key.endsWith('t') ? (pt.t || '') : (pt.d || '');
      }
      if (type === 'textarea') return `<label>${label}<textarea data-skey="${key}" rows="3">${val}</textarea></label>`;
      if (type === 'image') return `<label>${label}<span class="img-pick"><select data-skey="${key}">${media.map(m => `<option value="${m}" ${m === val ? 'selected' : ''}>${m.split('/').pop()}</option>`).join('')}</select><img class="site-img-preview" src="${val}" alt=""></span></label>`;
      return `<label>${label}<input data-skey="${key}" value="${String(val).replace(/"/g, '&quot;')}"></label>`;
    }).join('')}
    </fieldset>`).join('');
  buildClientsEditor(site.clients || []);
  form.querySelectorAll('select[data-skey="heroImage"]').forEach(sel => sel.addEventListener('change', () => {
    sel.closest('.img-pick').querySelector('img').src = sel.value;
  }));
  siteLoaded = true;
}
$('#siteSave').addEventListener('click', async () => {
  const obj = { safetyPoints: [] };
  $('#siteForm').querySelectorAll('[data-skey]').forEach(el => { obj[el.dataset.skey] = el.value; });
  for (let i = 1; i <= 3; i++) obj.safetyPoints.push({ t: obj['sp' + i + 't'] || '', d: obj['sp' + i + 'd'] || '' });
  obj.clients = [...document.querySelectorAll('.client-row')].map(row => ({
    name: row.querySelector('[data-cf="name"]').value.trim(),
    group: row.querySelector('[data-cf="group"]').value,
    note: row.querySelector('[data-cf="note"]').value,
    logo: row.querySelector('[data-cf="logo"]').value,
  })).filter(c => c.name);
  const r = await api('/api/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
  if (!r.ok) { $('#siteErr').textContent = 'Could not save — please try again.'; return; }
  $('#siteErr').textContent = '';
  toast('Saved — the website now shows your text.');
});

/* ---------- clients editor ---------- */
const CLIENT_GROUPS = ['Central Government', 'State Government & Corporations', 'Municipal & Local Bodies', 'Institutions & Private'];
function clientRow(c) {
  const row = document.createElement('div');
  row.className = 'client-row';
  row.innerHTML = `
    <input data-cf="name" placeholder="Client name" value="${(c.name || '').replace(/"/g, '&quot;')}">
    <select data-cf="group">${CLIENT_GROUPS.map(g => `<option ${g === c.group ? 'selected' : ''}>${g}</option>`).join('')}</select>
    <input data-cf="note" placeholder="Line under the name (e.g. Bus station, Bilimora)" value="${(c.note || '').replace(/"/g, '&quot;')}">
    <select data-cf="logo"><option value="">No logo (name plate)</option>${media.map(m => `<option value="${m}" ${m === c.logo ? 'selected' : ''}>${m.split('/').pop()}</option>`).join('')}</select>
    <button type="button" class="btn small danger">Remove</button>`;
  row.querySelector('button').onclick = () => row.remove();
  return row;
}
function buildClientsEditor(clients) {
  const box = $('#clientsEditor');
  box.innerHTML = '';
  clients.forEach(c => box.appendChild(clientRow(c)));
}
$('#clientAdd').addEventListener('click', () => $('#clientsEditor').appendChild(clientRow({})));

/* ---------- photos ---------- */
function renderMedia() {
  $('#mediaGrid').innerHTML = media.map(m => `
    <div class="media-card">
      <img src="${m}" alt="">
      <div class="mc-name">${m.split('/').pop()}</div>
      
      <div class="mc-actions">
        <button class="btn small" data-hero="${m}">Use as homepage banner</button>
        ${m.startsWith('uploads/') ? `<button class="btn small danger" data-mdel="${m}">Delete</button>` : ''}
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-hero]').forEach(b => b.onclick = async () => {
    const site = await (await api('/api/site')).json();
    site.heroImage = b.dataset.hero;
    await api('/api/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(site) });
    siteLoaded = false;
    toast('Homepage banner photo changed.');
  });
  document.querySelectorAll('[data-mdel]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this photo? Any work using it will show without a photo.')) return;
    const r = await api('/api/media?path=' + encodeURIComponent(b.dataset.mdel), { method: 'DELETE' });
    if (!r.ok) { alert((await r.json()).error || 'Could not delete'); return; }
    toast('Photo deleted.');
    await loadAll();
  });
}
$('#mediaUpload').addEventListener('click', async () => {
  const files = $('#mediaFiles').files;
  if (!files.length) { alert('Choose one or more photos first.'); return; }
  const fd = new FormData();
  [...files].forEach(f => fd.append('images', f));
  const r = await api('/api/media', { method: 'POST', body: fd });
  if (!r.ok) { alert('Upload failed — please try again.'); return; }
  $('#mediaFiles').value = '';
  toast('Photos uploaded — they are now in the library.');
  await loadAll();
});

/* ---------- auth ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#loginPw').value }) });
  if (!r.ok) { $('#loginErr').textContent = 'Wrong password — try again.'; return; }
  showDash(); await loadAll();
});
$('#logoutBtn').onclick = async () => { await fetch('/api/logout', { method: 'POST' }); showLogin(); };
$('#pwBtn').onclick = () => { $('#pwForm').reset(); $('#pwErr').textContent = ''; $('#pwModal').hidden = false; };
$('#pwClose').onclick = $('#pwCancel').onclick = () => { $('#pwModal').hidden = true; };
$('#pwForm').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await fetch('/api/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: $('#pw_current').value, next: $('#pw_next').value }) });
  if (!r.ok) { $('#pwErr').textContent = (await r.json()).error || 'Could not update'; return; }
  $('#pwModal').hidden = true; toast('Password updated.');
});

init();
