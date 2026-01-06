const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'health.json');
const BACKUP_FILE = path.join(DATA_DIR, 'health.backup.json');

const DEFAULT_STATE = {
  settings: {
    today: '',
    lastAutoToday: '',
    extraPastWeeks: 0,
    extraFutureWeeks: 0,
  },
  workouts: {},
  metrics: {},
  customDates: [],
  lastSaved: null,
};

const STATIC_FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/styles.css': 'styles.css',
  '/app.js': 'app.js',
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const payload = JSON.stringify(DEFAULT_STATE, null, 2);
    fs.writeFileSync(DATA_FILE, payload, 'utf8');
    fs.writeFileSync(BACKUP_FILE, payload, 'utf8');
  }
}

function readState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  ensureDataFile();
  const payload = JSON.stringify(state, null, 2);
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, payload, 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
  fs.writeFileSync(BACKUP_FILE, payload, 'utf8');
}

function normalizeState(data) {
  if (!data || typeof data !== 'object') return { ...DEFAULT_STATE };
  return {
    settings: {
      ...DEFAULT_STATE.settings,
      ...(data.settings || {}),
    },
    workouts: data.workouts || {},
    metrics: data.metrics || {},
    customDates: Array.isArray(data.customDates) ? data.customDates : [],
    lastSaved: data.lastSaved || DEFAULT_STATE.lastSaved,
  };
}

function isEmptyState(data) {
  if (!data) return true;
  const hasWorkouts = data.workouts && Object.keys(data.workouts).length > 0;
  const hasMetrics = data.metrics && Object.keys(data.metrics).length > 0;
  const hasCustom = Array.isArray(data.customDates) && data.customDates.length > 0;
  return !(hasWorkouts || hasMetrics || hasCustom);
}

function mergeState(base, incoming) {
  const baseState = normalizeState(base);
  const incomingState = normalizeState(incoming);

  if (isEmptyState(baseState)) return incomingState;

  const merged = normalizeState(baseState);

  Object.entries(incomingState.workouts).forEach(([date, value]) => {
    if (!merged.workouts[date]) merged.workouts[date] = value;
  });

  Object.entries(incomingState.metrics).forEach(([date, value]) => {
    if (!merged.metrics[date]) merged.metrics[date] = value;
  });

  merged.customDates = Array.from(new Set([...(merged.customDates || []), ...(incomingState.customDates || [])])).sort();

  if (!merged.settings.today && incomingState.settings.today) merged.settings.today = incomingState.settings.today;
  if (!merged.settings.lastAutoToday && incomingState.settings.lastAutoToday) {
    merged.settings.lastAutoToday = incomingState.settings.lastAutoToday;
  }

  if (!merged.lastSaved && incomingState.lastSaved) merged.lastSaved = incomingState.lastSaved;

  return merged;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e7) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': CONTENT_TYPES['.json'],
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(content);
  });
}

ensureDataFile();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/state') {
    if (req.method === 'GET') {
      return sendJson(res, 200, readState());
    }
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body || '{}');
        const normalized = normalizeState(parsed);
        writeState(normalized);
        return sendJson(res, 200, normalized);
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (url.pathname === '/api/import') {
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body || '{}');
        const current = readState();
        const merged = mergeState(current, parsed);
        writeState(merged);
        return sendJson(res, 200, merged);
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const fileName = STATIC_FILES[url.pathname];
  if (fileName) {
    return sendFile(res, path.join(ROOT_DIR, fileName));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Health dashboard running at http://localhost:${PORT}`);
});
