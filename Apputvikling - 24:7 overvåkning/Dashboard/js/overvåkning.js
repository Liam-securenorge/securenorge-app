(function(){
  const $  = (sel,root=document)=>root.querySelector(sel);
  const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));

  // Elements
  const tbody         = $('#mon-incidents-body');
  const onlyCritEl    = $('#onlyCritical');
  const onlyOpenEl    = $('#onlyOpen');
  const checksUl      = $('#mon-checks');

  // Local state
  let incidents = [];   // hele listen
  let timersHandle = null;

  // ---- Helpers ----
  const sevOrder = { critical:3, high:2, medium:1, low:0 };
  const statusOrder = { open:2, wip:1, done:0 };

  function fmtHHMMSS(ms){
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms/1000);
    const hh = Math.floor(s/3600).toString().padStart(2,'0');
    const mm = Math.floor((s%3600)/60).toString().padStart(2,'0');
    const ss = Math.floor(s%60).toString().padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function escapeHTML(s=''){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function applyFilters(list){
    let out = list;
    if (onlyCritEl?.checked) {
      out = out.filter(i => i.sev === 'critical' || i.sev === 'high');
    }
    if (onlyOpenEl?.checked) {
      out = out.filter(i => i.status === 'open' || i.status === 'wip');
    }
    return out.sort((a,b)=>{
      if (sevOrder[b.sev] !== sevOrder[a.sev]) return sevOrder[b.sev] - sevOrder[a.sev];
      if (statusOrder[b.status] !== statusOrder[a.status]) return statusOrder[b.status] - statusOrder[a.status];
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function renderIncidents(){
    if (!tbody) return;
    tbody.innerHTML = '';
    const view = applyFilters(incidents);
    view.forEach(inc => tbody.appendChild(rowFor(inc)));
    startTimers();
  }

  function rowFor(inc){
    const tr = document.createElement('tr');
    const created = inc.createdAt ? new Date(inc.createdAt) : new Date();
    const systemText = inc.data?.service || inc.data?.url || '-';
    const runningMs = (inc.status === 'done' ? (inc.resolvedAt || Date.now()) : Date.now()) - (inc.createdAt || Date.now());

    tr.dataset.id = inc.id;
    tr.innerHTML = `
      <td>${created.toLocaleString()}</td>
      <td><span class="sev sev--${inc.sev}">${(inc.sev||'medium').toUpperCase()}</span></td>
      <td>${escapeHTML(inc.title || '')}</td>
      <td>${escapeHTML(systemText)} ${systemText !== '-' ? '<span class="tag">monitor</span>' : ''}</td>
      <td><span class="timer" data-start="${inc.createdAt||Date.now()}" data-resolved="${inc.resolvedAt||''}" data-status="${inc.status}">${fmtHHMMSS(runningMs)}</span></td>
      <td><span class="st st--${statusClass(inc.status)}">${statusLabel(inc.status)}</span></td>
    `;
    return tr;
  }

  function statusClass(s){ return s==='open'?'open':s==='wip'?'wip':'done'; }
  function statusLabel(s){ return s==='open'?'Åpen':s==='wip'?'Pågår':'Løst'; }

  function startTimers(){
    stopTimers();
    timersHandle = setInterval(()=>{
      $$('.timer', tbody).forEach(el=>{
        const start = Number(el.dataset.start);
        const resolved = Number(el.dataset.resolved || 0);
        const status = el.dataset.status;
        const t = (status === 'done' && resolved) ? (resolved - start) : (Date.now() - start);
        el.textContent = fmtHHMMSS(Math.max(0,t));
      });
    }, 1000);
  }
  function stopTimers(){ if (timersHandle) clearInterval(timersHandle); }

  function upsertIncident(inc){
    const idx = incidents.findIndex(x => x.id === inc.id);
    if (idx === -1) incidents.unshift(inc);
    else incidents[idx] = inc;
    renderIncidents();
  }

  // ---- Checks UI ----
  function renderChecks(checks){
    if (!checksUl) return;
    checksUl.innerHTML = '';
    checks.forEach(c=>{
      const li = document.createElement('li');
      li.className = 'check';
      const dotClass = c.lastStatus === 'up' ? 'dot--ok' : (c.lastStatus === 'down' ? 'dot--bad' : 'dot--warn');
      li.innerHTML = `
        <span class="dot ${dotClass}"></span>
        <span class="check__name">${escapeHTML(c.name)}</span>
        <code class="check__url">${escapeHTML(c.url)}</code>
        <span class="check__status">${(c.lastStatus || 'unknown').toUpperCase()}</span>
      `;
      checksUl.appendChild(li);
    });
  }

  // ---- Initial load ----
  async function loadInitial(){
    const [incR, chkR] = await Promise.all([
      fetch('/api/mon/incidents', { credentials:'same-origin' }),
      fetch('/api/mon/checks',    { credentials:'same-origin' })
    ]);
    incidents = await incR.json();
    const checks = await chkR.json();
    renderIncidents();
    renderChecks(checks);
  }

  // ---- SSE stream ----
  function connectSSE(){
    const es = new EventSource('/api/mon/stream');
    es.addEventListener('incident.created', e => {
      try { upsertIncident(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener('incident.updated', e => {
      try { upsertIncident(JSON.parse(e.data)); } catch {}
    });
    es.addEventListener('check.updated', e => {
      // kunne oppdatert enkelt-check i lista; for enkelhet kan du re-hente hvis ønskelig
    });
    es.onerror = () => {
      // nettverksglitch → la browseren reconnecte automatisk
    };
  }

  // ---- Filter UI ----
  onlyCritEl?.addEventListener('change', renderIncidents);
  onlyOpenEl?.addEventListener('change', renderIncidents);

  // Go!
  loadInitial().then(connectSSE);
})();
