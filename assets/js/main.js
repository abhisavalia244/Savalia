// M/S Savalia Jaysukh M. — v2 interactions (restrained: no counters, no pop effects)
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('nav.main');
  if (burger && nav) burger.addEventListener('click', () => nav.classList.toggle('open'));

  // Hero: slow crossfade between the company's own banner photographs,
  // each with its caption describing what the photograph shows.
  const imgs = document.querySelectorAll('.hero-media img');
  const note = document.getElementById('photoNote');
  const dotsWrap = document.querySelector('.hero-dots');
  if (imgs.length > 1) {
    let cur = 0, timer;
    imgs.forEach((img, i) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Photograph ' + (i + 1));
      if (i === 0) b.classList.add('active');
      b.addEventListener('click', () => show(i));
      dotsWrap && dotsWrap.appendChild(b);
    });
    const dots = dotsWrap ? dotsWrap.querySelectorAll('button') : [];
    function show(i) {
      imgs[cur].classList.remove('active'); dots[cur] && dots[cur].classList.remove('active');
      cur = i;
      imgs[cur].classList.add('active'); dots[cur] && dots[cur].classList.add('active');
      if (note) note.textContent = imgs[cur].dataset.caption || '';
      clearInterval(timer); timer = setInterval(() => show((cur + 1) % imgs.length), 7000);
    }
    timer = setInterval(() => show((cur + 1) % imgs.length), 7000);
  }

  // Image fade-in on scroll (photographs only)
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
  document.querySelectorAll('.fade').forEach(el => io.observe(el));

  // ---- Works data: live from the admin-managed register (/api/works),
  //      falling back to the bundled record when the server is unreachable ----
  const CAT_ORDER = [['water', 'Water / Waste Water'], ['drainage', 'Drainage'], ['road', 'Road'], ['pipeline', 'Pipeline'], ['building', 'Building']];
  const FEATURED_TITLES = {
    'Upgradation of 155 MLD Sewage Treatment Plant to 255 MLD At Singanpore': 'assets/images/project-drainage.jpg',
    'Sewage Pumping Station 138 MLD': 'assets/images/hero-2.jpg',
    'Underground Service Reservoir- 170 Lacs. Liter': 'assets/images/project-building.jpg',
    'Elevated Service Reservoir (ESR)-12 Dumas': 'assets/images/hero-3.jpg',
    'K-7 DICL Pipeline Work': 'assets/images/project-pipeline.jpg',
    'Raw Water Reservoir 12500 Cum': null
  };
  const FEATURED_ORDER = [42, 6, 2, 3, 26, 7];
  function esc(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fallbackWorks() {
    if (typeof PROJECTS === 'undefined') return [];
    return PROJECTS.map(p => ({
      id: 'p' + p.no, no: p.no, title: p.title, categoryKey: p.filter, categoryLabel: p.category,
      client: p.client, location: p.location, capacity: p.capacity_norm, capNum: p.cap_num || 0,
      description: p.note || '', image: (p.title in FEATURED_TITLES) ? FEATURED_TITLES[p.title] : (p.temp_image || null), imageTemp: !!p.temp_image,
      featured: p.title in FEATURED_TITLES, featuredNote: '', year: ''
    }));
  }
  async function getWorks() {
    try {
      const r = await fetch('/api/works');
      if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) return d; }
    } catch (e) { /* fall through to bundled record */ }
    return fallbackWorks();
  }

  let activeFilter = 'all';
  function renderRegister(works) {
    const galleryEl = document.getElementById('worksGallery');
    const tabsEl = document.getElementById('filterTabs');
    const labelOf = k => (CAT_ORDER.find(c => c[0] === k) || [k, (works.find(w => w.categoryKey === k) || {}).categoryLabel || k])[1];
    const keys = CAT_ORDER.map(c => c[0]).filter(k => works.some(w => w.categoryKey === k));
    works.forEach(w => { if (!keys.includes(w.categoryKey)) keys.push(w.categoryKey); });

    if (tabsEl) {
      tabsEl.innerHTML = `<button class="ftab ${activeFilter === 'all' ? 'on' : ''}" data-f="all">All Works (${works.length})</button>` +
        keys.map(k => `<button class="ftab ${activeFilter === k ? 'on' : ''}" data-f="${k}">${esc(labelOf(k))} (${works.filter(w => w.categoryKey === k).length})</button>`).join('');
      tabsEl.querySelectorAll('.ftab').forEach(b => b.addEventListener('click', () => { activeFilter = b.dataset.f; renderRegister(works); }));
    }
    if (galleryEl) {
      const shown = activeFilter === 'all' ? keys : keys.filter(k => k === activeFilter);
      galleryEl.innerHTML = shown.map(k => {
        const list = works.filter(w => w.categoryKey === k).slice().sort((a, b) => (b.capNum || 0) - (a.capNum || 0));
        const cards = list.map(w => `
          <a class="pcard" href="work.html?id=${encodeURIComponent(w.id)}">
            <div class="pthumb">${w.image ? `<img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy">` : `<div class="plate"><img class="plate-logo" src="assets/images/logo.jpg" alt=""><div class="plate-name">M/s Savalia Jaysukh M.</div><div class="plate-cat">${esc(w.categoryLabel)} · Surat</div></div>`}<span class="pbadge">${esc(w.categoryLabel)}</span></div>
            <div class="pbody">
              <h3>${esc(w.title)}</h3>
              <div class="pmeta">${esc(w.client || '')}</div>
              <div class="pmeta dim">${[w.location, w.capacity, w.year].filter(Boolean).map(esc).join(' · ')}</div>
              <span class="pview">View record</span>
            </div>
          </a>`).join('');
        return `<div class="cat-block" id="cat-${k}"><h3>${esc(labelOf(k))} <span>${list.length} works</span></h3>
          <div class="pgrid">${cards}</div></div>`;
      }).join('');
    }
    const ci = document.getElementById('clientIndexBody');
    if (ci) {
      const counts = {};
      works.forEach(w => { if (w.client) counts[w.client] = (counts[w.client] || 0) + 1; });
      const parts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      ci.innerHTML = parts.map(([c, n], i) => i === 0 ? `<b>${esc(c)} — ${n} works</b>` : `${esc(c)} — ${n}`).join(' &nbsp;·&nbsp; ');
    }
    const lede = document.getElementById('expLede');
    if (lede) {
      const cats = new Set(works.map(w => w.categoryKey)).size;
      const smc = works.filter(w => w.client === 'Surat Municipal Corporation').length;
      lede.textContent = `The firm's detailed record of work — ${works.length} projects in ${cats} fields, each with its location, client and capacity. ${smc} of the ${works.length} works were executed for a single client, Surat Municipal Corporation.`;
    }
  }

  function renderFeatured(works) {
    const wrap = document.getElementById('worksList');
    const link = document.getElementById('worksCountLink');
    if (link) link.textContent = `Full list of ${works.length} works`;
    if (!wrap) return;
    const feat = works.filter(w => w.featured);
    if (!feat.length) return;
    feat.sort((a, b) => {
      const ia = FEATURED_ORDER.indexOf(a.no), ib = FEATURED_ORDER.indexOf(b.no);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (b.capNum || 0) - (a.capNum || 0);
    });
    wrap.innerHTML = feat.slice(0, 8).map((w, i) => {
      const rows = [['Client', w.client], ['Location', w.location], ['Capacity', w.capacity], ['Type', w.categoryLabel], ['Completed', w.year]]
        .filter(r => r[1]).map(r => `<div class="row"><span>${esc(r[0])}</span><span>${esc(r[1])}</span></div>`).join('');
      const FEATURED_CAPTIONS = {
        'Upgradation of 155 MLD Sewage Treatment Plant to 255 MLD At Singanpore': 'Circular tank works under construction',
        'Sewage Pumping Station 138 MLD': 'Reinforcement and shuttering for a circular tank',
        'Underground Service Reservoir- 170 Lacs. Liter': 'Roof of an underground reservoir, with its pumping building',
        'Elevated Service Reservoir (ESR)-12 Dumas': 'ESR-12 and ESR-15, Dumas — photographed after completion',
        'K-7 DICL Pipeline Work': 'Large-diameter pipeline work'
      };
      const fig = w.image ? `<figure><img src="${esc(w.image)}" alt="${esc(w.title)}"><figcaption>${esc(FEATURED_CAPTIONS[w.title] || w.location || '')}</figcaption></figure>` : '';
      return `<article class="work${w.image ? '' : ' noimg'}"><div class="no">${String(i + 1).padStart(2, '0')}</div>
        <div><h3>${esc(w.title)}</h3>
        <p>${esc(w.featuredNote || w.description || '')}</p>
        <div class="spec">${rows}</div></div>
        ${fig}
      </article>`;
    }).join('');
  }

  // ---- Site content (admin-editable texts & details) ----
  async function applySite() {
    let site = null;
    try { const r = await fetch('/api/site'); if (r.ok) site = await r.json(); } catch (e) { /* keep printed defaults */ }
    if (!site) return;
    document.querySelectorAll('[data-site]').forEach(el => {
      const k = el.dataset.site;
      if (site[k] == null) return;
      el.textContent = site[k];
      if (k === 'email' && el.tagName === 'A') el.href = 'mailto:' + site[k];
      if (k === 'phone' && el.tagName === 'A') el.href = 'tel:' + site[k].replace(/[^+\d]/g, '');
    });
    document.querySelectorAll('[data-site-img]').forEach(el => {
      const k = el.dataset.siteImg;
      if (site[k]) el.src = site[k];
    });
    if (Array.isArray(site.clients) && site.clients.length) {
      const wall = document.getElementById('logoWall');
      if (wall) {
        wall.innerHTML = site.clients.map(c => c.logo
          ? `<div class="lw-cell"><img src="${esc(c.logo)}" alt="${esc(c.name)}"><span class="lw-name">${esc(c.name)}</span></div>`
          : `<div class="lw-cell"><div class="lw-plate">${esc(c.name)}</div><span class="lw-name dim">Logo not available</span></div>`).join('');
      }
      const groupsEl = document.getElementById('clientGroups');
      if (groupsEl) {
        const order = ['Central Government', 'State Government & Corporations', 'Municipal & Local Bodies', 'Institutions & Private'];
        const extra = [...new Set(site.clients.map(c => c.group).filter(g => g && !order.includes(g)))];
        groupsEl.innerHTML = [...order, ...extra].filter(g => site.clients.some(c => c.group === g)).map(g =>
          `<div class="client-group"><h4>${esc(g)}</h4><ul>${site.clients.filter(c => c.group === g).map(c => `<li>${esc(c.name)}<span>${esc(c.note)}</span></li>`).join('')}</ul></div>`).join('');
      }
    }
    if (Array.isArray(site.safetyPoints)) {
      site.safetyPoints.forEach((pt, i) => {
        const t = document.querySelector(`[data-sp="${i}t"]`);
        const d = document.querySelector(`[data-sp="${i}d"]`);
        if (t) t.textContent = pt.t || '';
        if (d) d.textContent = pt.d || '';
      });
    }
  }
  applySite();

  getWorks().then(works => {
    renderRegister(works);
    renderFeatured(works);
    document.querySelectorAll('[data-catcount]').forEach(el => {
      el.textContent = works.filter(w => w.categoryKey === el.dataset.catcount).length;
    });
  });

  // Inquiry form — composes an email to the office with the form contents.
  // (No server mailbox is connected yet; sending happens through the visitor's
  //  own email application, addressed to savaliajm@yahoo.com.)
  document.querySelectorAll('form[data-inquiry]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(f);
    const subject = 'Inquiry — ' + (d.get('subject') || 'General') + ' — ' + (d.get('firstName') || '') + ' ' + (d.get('lastName') || '');
    const lines = [
      'Name: ' + (d.get('firstName') || '') + ' ' + (d.get('lastName') || ''),
      'Email: ' + (d.get('email') || ''),
      'Phone: ' + (d.get('phone') || ''),
      'City: ' + (d.get('city') || ''),
      'Subject: ' + (d.get('subject') || ''),
      'Priority: ' + (d.get('priority') || ''),
      '',
      'Message:',
      d.get('message') || ''
    ];
    window.location.href = 'mailto:savaliajm@yahoo.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    const ok = f.querySelector('.form-ok');
    if (ok) { ok.style.display = 'block'; ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }));

  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
});
