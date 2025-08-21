// Minimal mock-motor for sårbarhetsscanner (ingen backend)
(function initScanner() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScanner);
    return;
  }
  const form = document.getElementById('scanForm');
  const queue = document.getElementById('scanQueue');
  const findingsTable = document.getElementById('findingsTable')?.querySelector('tbody');
  const chipRow = document.getElementById('severityChips');
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiCritical = document.getElementById('kpiCritical');
  const kpiHigh = document.getElementById('kpiHigh');
  const exportBtn = document.getElementById('exportCsv');

  if (!form || !queue || !findingsTable) return;

  let findingsData = []; // samlet funn for filter/eksport

  function addQueueItem({ target, profile }) {
    if (queue.firstElementChild && queue.firstElementChild.classList.contains('muted')) {
      queue.firstElementChild.remove();
    }
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `
      <div class="queue-head">
        <strong>${target}</strong>
        <span class="queue-meta">${profile.toUpperCase()} • <time>nå</time></span>
      </div>
      <div class="progress"><div class="progress__bar"></div></div>
      <div class="queue-meta">Status: <span class="st st--wip">Kjører</span></div>
    `;
    queue.prepend(li);

    const bar = li.querySelector('.progress__bar');
    let pct = 0;
    const tick = setInterval(() => {
      pct = Math.min(100, pct + Math.random() * 8 + 4);
      bar.style.width = pct.toFixed(0) + '%';
      if (pct >= 100) {
        clearInterval(tick);
        li.querySelector('.st').classList.remove('st--wip');
        li.querySelector('.st').classList.add('st--done');
        li.querySelector('.st').textContent = 'Ferdig';

        const mock = generateFindings(target);
        mock.forEach(row => appendFinding(row));
        findingsData.push(...mock);
        refreshKPIs();
        exportBtn.disabled = findingsData.length === 0;
      }
    }, 450);
  }

  function generateFindings(target) {
    const bank = [
      { sev:'critical', rule:'CVE-2024-12345', desc:'Remote Code Execution via deserialisering', res:'/api/v1/export', status:'Åpen' },
      { sev:'high',     rule:'SQLi',           desc:'Parametrisk injeksjon mulig i query', res:'/search?q=*', status:'Under arbeid' },
      { sev:'medium',   rule:'CWE-79',         desc:'Reflected XSS i parameter', res:'/profile?name=', status:'Åpen' },
      { sev:'low',      rule:'TLS',            desc:'Svake chiffer i HTTPS', res:'TLS config', status:'Løst' },
      { sev:'high',     rule:'nuclei:exposed-panel', desc:'Admin-panel eksponert uten auth', res:'/admin', status:'Åpen' },
    ];
    const n = Math.floor(Math.random()*3)+2;
    const out = [];
    for (let i=0;i<n;i++){
      const pick = {...bank[Math.floor(Math.random()*bank.length)]};
      pick.target = target;
      out.push(pick);
    }
    return out;
  }

  function appendFinding(row) {
    const tr = document.createElement('tr');
    const sevClass = (s) => ({
      critical: 'sev sev--critical',
      high: 'sev sev--high',
      medium: 'sev sev--medium',
      low: 'sev sev--low',
    }[s] || 'sev');
    tr.dataset.sev = row.sev;
    tr.innerHTML = `
      <td><span class="${sevClass(row.sev)}">${row.sev}</span></td>
      <td><code>${row.rule}</code></td>
      <td>${row.desc}</td>
      <td>${row.target}</td>
      <td><code>${row.res}</code></td>
      <td><span class="st ${row.status==='Åpen'?'st--open':row.status==='Løst'?'st--done':'st--wip'}">${row.status}</span></td>
    `;
    findingsTable.prepend(tr);
  }

  function refreshKPIs(){
    const all = findingsTable.querySelectorAll('tr').length;
    const crit = findingsTable.querySelectorAll('tr[data-sev="critical"]').length;
    const high = findingsTable.querySelectorAll('tr[data-sev="high"]').length;
    kpiTotal.textContent = String(all);
    kpiCritical.textContent = String(crit);
    kpiHigh.textContent = String(high);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = form.target.value.trim();
    if (!target) return;
    addQueueItem({ target, profile: form.profile.value });
    form.reset();
    form.profile.value = 'quick';
    form.risk.value = 'medium';
  });

  chipRow?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    for (const b of chipRow.querySelectorAll('.chip')) b.classList.remove('chip--on');
    btn.classList.add('chip--on');
    const sev = btn.dataset.sev;
    for (const tr of findingsTable.querySelectorAll('tr')) {
      tr.style.display = (sev === 'all' || tr.dataset.sev === sev) ? '' : 'none';
    }
  });

  exportBtn?.addEventListener('click', () => {
    if (!findingsData.length) return;
    const header = ['severity','rule','description','target','resource','status'];
    const rows = findingsData.map(f => [f.sev,f.rule,JSON.stringify(f.desc),f.target,f.res,f.status]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'secure-norge-findings.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();



(function setupDepthSlider(){
  const el = document.getElementById('depth');
  if (!el) return;

  const KEY = 'secureNorge.depth';   // storage key
  const paint = () => {
    // 0–100%
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.background = `linear-gradient(to right,
      var(--sev-high) 0%,
      var(--sev-high) ${pct}%,
      var(--line)     ${pct}%,
      var(--line)     100%)`;
    el.style.backgroundSize = '100% 10px';   // match CSS track height
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat   = 'no-repeat';
  };

  // Restore saved value (if valid), then paint
  const saved = localStorage.getItem(KEY);
  if (saved !== null) {
    const num = Number(saved);
    if (!Number.isNaN(num)) {
      const clamped = Math.min(Number(el.max), Math.max(Number(el.min), num));
      el.value = String(clamped);
    }
  }
  paint();

  // Persist on input/change
  const saveAndPaint = () => { localStorage.setItem(KEY, el.value); paint(); };
  el.addEventListener('input',  saveAndPaint);
  el.addEventListener('change', saveAndPaint);

  // Repaint when layout might shift
  window.addEventListener('resize', paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });

  // If your form has a reset button and you want the slider to keep the saved value:
  const form = el.closest('form');
  form?.addEventListener('reset', () => {
    // restore the saved value after the browser resets form controls
    setTimeout(() => {
      const savedAfter = localStorage.getItem(KEY);
      if (savedAfter !== null) el.value = savedAfter;
      paint();
    }, 0);
  });
})();

