/* ===== 24/7 Overvåkning (MVP) ===== */
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'monitor.json');

async function ensureDataFile() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
  if (!fssync.existsSync(DB_FILE)) {
    const seed = {
      incidents: [],
      checks: [
        // Eksempel-checks (bytt URL’er til deres interne health-endepunkt)
        { id: randomUUID(), name: 'Portal Health', type: 'http', url: 'https://example.org/', freqSec: 60, lastStatus: 'unknown', lastRun: 0, openIncidentId: null, slaMin: 30, sev: 'high' },
        { id: randomUUID(), name: 'API Health',    type: 'http', url: 'https://example.com/', freqSec: 60, lastStatus: 'unknown', lastRun: 0, openIncidentId: null, slaMin: 15, sev: 'critical' }
      ],
      oncall: { name: 'SOC – Vakt A', until: Date.now() + 6 * 3600_000 } // +6 timer
    };
    await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
  }
}
await ensureDataFile();

async function loadDB(){ return JSON.parse(await fs.readFile(DB_FILE, 'utf-8')); }
async function saveDB(db){ await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8'); }

function sseSend(res, event, data){
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const sseClients = new Set();

// SSE-strøm (kun innloggede slipper hit pga auth-gate)
app.get('/api/mon/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  sseClients.add(res);
  sseSend(res, 'hello', { t: Date.now() });

  req.on('close', () => { sseClients.delete(res); });
});

function broadcast(event, payload){
  for (const c of sseClients) sseSend(c, event, payload);
}

// List hendelser
app.get('/api/mon/incidents', async (req, res) => {
  const db = await loadDB();
  const { status } = req.query;
  let items = db.incidents.sort((a,b)=>b.createdAt - a.createdAt);
  if (status) items = items.filter(i => i.status === status);
  res.json(items);
});

// Opprett hendelse (kan brukes av andre systemer eller for test)
app.post('/api/mon/incidents', async (req, res) => {
  const { title, sev='medium', source='manual', slaMin=30, data={} } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title påkrevd' });
  const db = await loadDB();
  const inc = {
    id: randomUUID(),
    title, sev, source, data,
    status: 'open',
    createdAt: Date.now(),
    acknowledgedAt: null,
    resolvedAt: null,
    assignee: null,
    slaMin,
  };
  db.incidents.push(inc);
  await saveDB(db);
  broadcast('incident.created', inc);
  res.json(inc);
});

// Oppdater hendelse (ack / resolve / assign)
app.patch('/api/mon/incidents/:id', async (req, res) => {
  const { id } = req.params;
  const { action, assignee } = req.body || {};
  const db = await loadDB();
  const inc = db.incidents.find(i => i.id === id);
  if (!inc) return res.status(404).json({ error: 'Not found' });

  if (action === 'ack' && inc.status === 'open') {
    inc.status = 'wip';
    inc.acknowledgedAt = Date.now();
    if (assignee) inc.assignee = assignee;
  } else if (action === 'resolve' && inc.status !== 'done') {
    inc.status = 'done';
    inc.resolvedAt = Date.now();
  } else if (action === 'assign' && assignee) {
    inc.assignee = assignee;
  }

  await saveDB(db);
  broadcast('incident.updated', inc);
  res.json(inc);
});

// List checks (for UI)
app.get('/api/mon/checks', async (_req, res) => {
  const db = await loadDB();
  res.json(db.checks);
});

// Enkel check-runner: kjører periodisk og lager/avslutter hendelser
const RUNNER_TICK_MS = 5_000;
setInterval(async () => {
  const db = await loadDB();
  const now = Date.now();

  for (const chk of db.checks) {
    if (now - chk.lastRun < (chk.freqSec * 1000)) continue; // ikke tid ennå

    chk.lastRun = now;
    // Kjør HTTP-check
    let ok = false;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8_000);
      const r = await fetch(chk.url, { method:'GET', signal: ctrl.signal });
      clearTimeout(tid);
      ok = r.ok;
    } catch { ok = false; }

    const prev = chk.lastStatus;
    chk.lastStatus = ok ? 'up' : 'down';

    // Ned -> åpne hendelse hvis ikke allerede åpen
    if (!ok && !chk.openIncidentId) {
      const inc = {
        id: randomUUID(),
        title: `${chk.name} er NED`,
        sev: chk.sev || 'high',
        source: 'check',
        data: { checkId: chk.id, url: chk.url },
        status: 'open',
        createdAt: now,
        acknowledgedAt: null,
        resolvedAt: null,
        assignee: null,
        slaMin: chk.slaMin || 30
      };
      db.incidents.push(inc);
      chk.openIncidentId = inc.id;
      broadcast('incident.created', inc);
    }

    // Opp -> lukk åpen hendelse (hvis noen)
    if (ok && chk.openIncidentId) {
      const inc = db.incidents.find(i => i.id === chk.openIncidentId);
      if (inc && inc.status !== 'done') {
        inc.status = 'done';
        inc.resolvedAt = now;
        broadcast('incident.updated', inc);
      }
      chk.openIncidentId = null;
    }

    // Endret status på check → push oppdatering (valgfritt)
    if (prev !== chk.lastStatus) {
      broadcast('check.updated', { id: chk.id, lastStatus: chk.lastStatus, lastRun: chk.lastRun });
    }
  }

  await saveDB(db);
}, RUNNER_TICK_MS);
