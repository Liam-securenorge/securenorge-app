// Leaflet-kart – init ved DOMContentLoaded
(function initMapWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapWhenReady);
    return;
  }
  // Leaflet må være lastet, og kartdiven finnes
  if (!window.L || !document.getElementById('map')) return;

  // Les CSS-variabler for farger
  const css = getComputedStyle(document.documentElement);
  const get = (v) => css.getPropertyValue(v).trim();
  const colLine   = get('--line')        || '#2d323b';
  const colCrit   = get('--sev-critical')|| '#f87171';
  const colHigh   = get('--sev-high')    || '#fb923c';
  const colMed    = get('--sev-medium')  || '#fbbf24';
  const colLow    = get('--sev-low')     || '#34d399';

  // Opprett kart (Norge)
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
  }).setView([60.4720, 8.4689], 5);

  // Mørk bakgrunn som matcher tema
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        'contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  ).addTo(map);

  // Demo-punkter (bytt til deres faktiske posisjoner etter behov)
  const points = [
    { name: 'Oslo HQ',       host: 'HQ-OSL-01',    sev: 'high',     coords: [59.9139, 10.7522] },
    { name: 'Bergen Node',   host: 'BRG-SRV-02',   sev: 'medium',   coords: [60.39299, 5.32415] },
    { name: 'Trondheim SOC', host: 'TRD-SOC-03',   sev: 'low',      coords: [63.4305, 10.3951] },
    { name: 'Stavanger DC',  host: 'SVG-DC-04',    sev: 'critical', coords: [58.96998, 5.73311] },
  ];
  const sevColor = { critical: colCrit, high: colHigh, medium: colMed, low: colLow };

  points.forEach(p => {
    const marker = L.circleMarker(p.coords, {
      radius: 7,
      weight: 2,
      color: colLine,
      fillColor: sevColor[p.sev] || colLow,
      fillOpacity: 0.9
    }).addTo(map);

    marker.bindPopup(`
      <strong>${p.name}</strong><br>
      Vert: <code>${p.host}</code><br>
      Alvorsgrad:
      <span style="display:inline-block;padding:2px 6px;border-radius:999px;color:#111;background:${sevColor[p.sev] || colLow};font-weight:700;font-size:12px;">
        ${p.sev.toUpperCase()}
      </span>
    `);
  });

  // Skala
  L.control.scale({ imperial: false }).addTo(map);
})();

// === Login popup logic (non-blocking + centered blur) ===
(function loginPopupInit(){
  const popup     = document.getElementById('loginPopup');
  const backdrop  = document.getElementById('loginBackdrop');
  if (!popup) return;

  // Finn "Logg inn"-knappen i header uten å endre HTML
  const loginBtn = Array.from(document.querySelectorAll('.actions .btn'))
    .find(b => (b.textContent || '').toLowerCase().includes('logg inn'));

  const closeBtn  = popup.querySelector('.login-popup__close');
  const cancelBtn = document.getElementById('loginCancel');
  const form      = document.getElementById('loginForm');
  const user      = document.getElementById('loginUser');
  const pass      = document.getElementById('loginPass');
  const userErr   = document.getElementById('userError');
  const passErr   = document.getElementById('passError');
  const statusEl  = document.getElementById('loginStatus');
  const togglePw  = popup.querySelector('.password__toggle');

  function open() {
    popup.hidden = false;
    if (backdrop) backdrop.hidden = false;
    setTimeout(() => user && user.focus(), 0);
    loginBtn && loginBtn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    popup.hidden = true;
    if (backdrop) backdrop.hidden = true;
    loginBtn && loginBtn.setAttribute('aria-expanded', 'false');
    form.reset();
    userErr.textContent = '';
    passErr.textContent = '';
    statusEl.textContent = '';
    togglePw.textContent = 'Vis';
    pass.type = 'password';
  }

  if (loginBtn) loginBtn.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  cancelBtn && cancelBtn.addEventListener('click', close);

  // ESC lukker
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !popup.hidden) close();
  });

  // Klikk utenfor lukker (siden er klikkbar pga pointer-events:none på backdrop)
  document.addEventListener('click', e => {
    if (popup.hidden) return;
    const withinPopup = popup.contains(e.target);
    const clickedLoginBtn = loginBtn && loginBtn.contains(e.target);
    if (!withinPopup && !clickedLoginBtn) close();
  });

  // Hvis du vil "tvinge" login (blokkere klikk utenfor):
  // 1) CSS: .login-backdrop { pointer-events: auto; }
  // 2) JS:  backdrop && backdrop.addEventListener('click', () => {}); // ikke lukk på backdrop
  // 3) Fjern document-click-listeneren over.

  // Toggle passord
  togglePw.addEventListener('click', () => {
    if (pass.type === 'password') { pass.type = 'text'; togglePw.textContent = 'Skjul'; }
    else { pass.type = 'password'; togglePw.textContent = 'Vis'; }
    pass.focus();
  });

  // Demo-innlogging
  form.addEventListener('submit', e => {
    e.preventDefault();
    userErr.textContent = '';
    passErr.textContent = '';
    statusEl.textContent = '';

    let ok = true;
    if (!user.value.trim()) { userErr.textContent = 'Skriv inn e-post eller brukernavn.'; ok = false; }
    if (!pass.value.trim()) { passErr.textContent = 'Skriv inn passord.'; ok = false; }
    if (!ok) return;

    statusEl.textContent = 'Logger inn…';
    const btn = document.getElementById('loginSubmit');
    btn.disabled = true;

    setTimeout(() => {
      statusEl.textContent = 'Innlogging vellykket (demo).';
      btn.disabled = false;
      setTimeout(close, 600);
    }, 700);
  });

  // ⬇️ NYTT: Åpne popup automatisk ved side-load
  open();
})();

// === Innstillinger popup ===
(function settingsInit(){
  const popup = document.getElementById('settingsPopup');
  const backdrop = document.getElementById('loginBackdrop'); // gjenbruk blur
  if (!popup) return;

  // Åpne fra topbar-knappen (via aria-label)
  const openBtn = document.querySelector('button[aria-label="Innstillinger"]');
  const closeIcon = popup.querySelector('.settings__close');
  const btnClose = document.getElementById('settingsClose');
  const btnSave  = document.getElementById('settingsSave');
  const btnReset = document.getElementById('settingsReset');

  // Tabs
  const tabs = Array.from(popup.querySelectorAll('.settings__tab'));
  const panels = Array.from(popup.querySelectorAll('.settings__panel'));

  // Felter
  const els = {
    language:   document.getElementById('set-language'),
    timezone:   document.getElementById('set-timezone'),
    datefmt:    document.getElementById('set-datefmt'),
    defrange:   document.getElementById('set-defrange'),
    rows:       document.getElementById('set-rows'),

    theme:      document.getElementById('set-theme'),
    density:    document.getElementById('set-density'),
    sticky:     document.getElementById('set-sticky'),
    grid:       document.getElementById('set-grid'),
    anim:       document.getElementById('set-animations'),

    mail:       document.getElementById('set-mail'),
    email:      document.getElementById('set-email'),
    critical:   document.getElementById('set-critical'),
    digest:     document.getElementById('set-digest'),
    quiet:      document.getElementById('set-quiet'),
    webhook:    document.getElementById('set-webhook'),

    fa:         document.getElementById('set-2fa'),
    timeout:    document.getElementById('set-timeout'),
    mask:       document.getElementById('set-mask'),
    allowlist:  document.getElementById('set-allowlist'),

    refresh:    document.getElementById('set-refresh'),
    api:        document.getElementById('set-api'),
    token:      document.getElementById('set-token'),
    exportFmt:  document.getElementById('set-export'),

    org:        document.getElementById('set-org'),
    role:       document.getElementById('set-role'),
    policy:     document.getElementById('set-policy')
  };

  const KEY = 'snSettings';

  function open(){
    popup.hidden = false;
    if (backdrop) backdrop.hidden = false;
    openBtn && openBtn.setAttribute('aria-expanded', 'true');
    // fokus første tab
    tabs[0]?.focus();
  }
  function close(){
    popup.hidden = true;
    if (backdrop) backdrop.hidden = true;
    openBtn && openBtn.setAttribute('aria-expanded', 'false');
  }

  // Åpne/Lukk
  openBtn && openBtn.addEventListener('click', open);
  closeIcon && closeIcon.addEventListener('click', close);
  btnClose && btnClose.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !popup.hidden) close(); });
  // Klikk utenfor – fordi backdrop har pointer-events:none, lytter vi på document
  document.addEventListener('click', e => {
    if (popup.hidden) return;
    const within = popup.contains(e.target) || (openBtn && openBtn.contains(e.target));
    if (!within) close();
  });

  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('settings__tab--active', t === tab));
      panels.forEach(p => p.classList.toggle('settings__panel--active', p.dataset.panel === id));
    });
  });

  // Persist / Last
  function save(){
    const data = {
      language: els.language.value,
      timezone: els.timezone.value,
      datefmt: els.datefmt.value,
      defrange: els.defrange.value,
      rows: els.rows.value,
      theme: els.theme.value,
      density: els.density.value,
      sticky: els.sticky.checked,
      grid: els.grid.checked,
      anim: els.anim.checked,
      mail: els.mail.checked,
      email: els.email.value,
      critical: els.critical.checked,
      digest: els.digest.value,
      quiet: els.quiet.value,
      webhook: els.webhook.value,
      fa: els.fa.checked,
      timeout: Number(els.timeout.value || 0),
      mask: els.mask.checked,
      allowlist: els.allowlist.value,
      refresh: Number(els.refresh.value || 0),
      api: els.api.value,
      token: els.token.value,
      exportFmt: els.exportFmt.value,
      org: els.org.value,
      role: els.role.value,
      policy: els.policy.value
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    apply(data);
  }

  function load(){
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.language) els.language.value = d.language;
      if (d.timezone) els.timezone.value = d.timezone;
      if (d.datefmt)  els.datefmt.value  = d.datefmt;
      if (d.defrange) els.defrange.value = d.defrange;
      if (d.rows)     els.rows.value     = d.rows;

      if (d.theme)    els.theme.value    = d.theme;
      if (d.density)  els.density.value  = d.density;
      if (typeof d.sticky === 'boolean') els.sticky.checked = d.sticky;
      if (typeof d.grid   === 'boolean') els.grid.checked   = d.grid;
      if (typeof d.anim   === 'boolean') els.anim.checked   = d.anim;

      if (typeof d.mail   === 'boolean') els.mail.checked   = d.mail;
      if (d.email)    els.email.value    = d.email;
      if (typeof d.critical === 'boolean') els.critical.checked = d.critical;
      if (d.digest)   els.digest.value   = d.digest;
      if (d.quiet)    els.quiet.value    = d.quiet;
      if (d.webhook)  els.webhook.value  = d.webhook;

      if (typeof d.fa === 'boolean')     els.fa.checked     = d.fa;
      if (d.timeout)  els.timeout.value  = d.timeout;
      if (typeof d.mask === 'boolean')   els.mask.checked   = d.mask;
      if (d.allowlist) els.allowlist.value = d.allowlist;

      if (d.refresh != null) els.refresh.value = d.refresh;
      if (d.api)      els.api.value      = d.api;
      if (d.token)    els.token.value    = d.token;
      if (d.exportFmt) els.exportFmt.value = d.exportFmt;

      if (d.org)      els.org.value      = d.org;
      if (d.role)     els.role.value     = d.role;
      if (d.policy)   els.policy.value   = d.policy;

      apply(d);
    } catch {}
  }

  // Anvend enkelte valg direkte i UI
  function apply(d){
    // Tetthet
    document.body.classList.toggle('density--compact', d.density === 'compact');
    // Gridlinjer i diagram
    document.body.classList.toggle('charts--no-grid', d.grid === false);
    // Sticky topbar
    document.body.classList.toggle('no-sticky', d.sticky === false);
    // (Tema og animasjoner kan kobles på her senere)
  }

  // Hurtiglagring ved endring
  popup.addEventListener('change', (e) => {
    // ikke lagre hvis knapper etc – men her holder vi det enkelt:
    save();
  });

  // Knappene
  btnSave && btnSave.addEventListener('click', () => { save(); close(); });
  btnReset && btnReset.addEventListener('click', () => {
    localStorage.removeItem(KEY);
    popup.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'checkbox') el.checked = el.defaultChecked;
      else el.value = el.defaultValue || '';
    });
    apply({
      density: els.density.defaultValue,
      grid: true,
      sticky: true
    });
  });

  // Init
  load();
})();

