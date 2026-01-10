const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'health.json');
const BACKUP_FILE = path.join(DATA_DIR, 'health.backup.json');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');

const DEFAULT_STATE = {
  settings: {
    today: '',
    lastAutoToday: '',
    extraPastWeeks: 0,
    extraFutureWeeks: 0,
    heightCm: '',
  },
  workouts: {},
  metrics: {},
  customDates: [],
  lastSaved: null,
};

const DEFAULT_WEIGHTED_FORMULA = '0.006 * (load + 0.1 * bw)';
const DEFAULT_BODYWEIGHT_FORMULA = '0.007 * (0.66 * bw)';

const DEFAULT_CONFIG = {
  scheduleDays: [1, 3, 5],
  defaultPastWeeks: 1,
  defaultFutureWeeks: 2,
  darkMode: false,
  exerciseGroups: {
    armsBack: {
      label: 'Arms / Back',
      exercises: [
        { id: 'latPulldown', label: 'Lat Pulldown', hasWeight: true, kcalFormula: DEFAULT_WEIGHTED_FORMULA },
        { id: 'shoulderPress', label: 'Shoulder Press', hasWeight: true, kcalFormula: DEFAULT_WEIGHTED_FORMULA },
        { id: 'bicepsCurl', label: 'Biceps Curl', hasWeight: true, kcalFormula: '0.004 * (load + 0.1 * bw)' },
        { id: 'pushUp', label: 'Push-up', hasWeight: false, kcalFormula: DEFAULT_BODYWEIGHT_FORMULA },
        { id: 'pullUp', label: 'Pull-up', hasWeight: false, kcalFormula: '0.008 * (1.0 * bw)' },
      ],
    },
    coreAbs: {
      label: 'Core / Abs',
      exercises: [
        { id: 'abdominal', label: 'Abdominal', hasWeight: true, kcalFormula: '0.003 * (load + 0.2 * bw)' },
        { id: 'sitUp', label: 'Sit-up', hasWeight: false, kcalFormula: '0.005 * (0.4 * bw)' },
      ],
    },
  },
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

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const payload = JSON.stringify(DEFAULT_CONFIG, null, 2);
    fs.writeFileSync(CONFIG_FILE, payload, 'utf8');
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

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (error) {
    return normalizeConfig(DEFAULT_CONFIG);
  }
}

function writeConfig(config) {
  const payload = JSON.stringify(config, null, 2);
  const tmpFile = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmpFile, payload, 'utf8');
  fs.renameSync(tmpFile, CONFIG_FILE);
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

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function formulaUsesLoad(formula) {
  if (!formula || typeof formula !== 'string') return false;
  return /\bload\b/.test(formula);
}

function normalizeConfig(data) {
  const source = data && typeof data === 'object' ? data : {};
  const baseDays = Array.isArray(DEFAULT_CONFIG.scheduleDays) ? DEFAULT_CONFIG.scheduleDays : [1, 3, 5];
  const rawDays = Array.isArray(source.scheduleDays) ? source.scheduleDays : baseDays;
  const days = Array.from(new Set(rawDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
  if (!days.length) days.push(...baseDays);

  const defaultPastWeeks = clampNumber(source.defaultPastWeeks, 0, 52, DEFAULT_CONFIG.defaultPastWeeks);
  const defaultFutureWeeks = clampNumber(source.defaultFutureWeeks, 0, 52, DEFAULT_CONFIG.defaultFutureWeeks);
  const darkMode = Boolean(source.darkMode);

  const exerciseGroups = {};
  const sourceGroups = source.exerciseGroups && typeof source.exerciseGroups === 'object' ? source.exerciseGroups : {};

  Object.keys(DEFAULT_CONFIG.exerciseGroups).forEach((groupKey) => {
    const baseGroup = DEFAULT_CONFIG.exerciseGroups[groupKey];
    const incomingGroup = sourceGroups[groupKey] && typeof sourceGroups[groupKey] === 'object' ? sourceGroups[groupKey] : null;
    const label = incomingGroup && typeof incomingGroup.label === 'string' && incomingGroup.label.trim()
      ? incomingGroup.label.trim()
      : baseGroup.label;
    const exercisesSource = incomingGroup && Array.isArray(incomingGroup.exercises)
      ? incomingGroup.exercises
      : baseGroup.exercises;

    const normalizedExercises = [];
    const seen = new Set();

    exercisesSource.forEach((exercise) => {
      if (!exercise || typeof exercise !== 'object') return;
      const id = typeof exercise.id === 'string' ? exercise.id.trim() : '';
      if (!id || seen.has(id)) return;
      const labelValue = typeof exercise.label === 'string' && exercise.label.trim() ? exercise.label.trim() : id;
      let kcalFormula = typeof exercise.kcalFormula === 'string' ? exercise.kcalFormula.trim() : '';
      if (!kcalFormula) {
        kcalFormula = DEFAULT_WEIGHTED_FORMULA;
      }
      const hasWeight = formulaUsesLoad(kcalFormula);
      normalizedExercises.push({
        id,
        label: labelValue,
        hasWeight,
        kcalFormula,
      });
      seen.add(id);
    });

    exerciseGroups[groupKey] = {
      label,
      exercises: normalizedExercises,
    };
  });

  return {
    scheduleDays: days,
    defaultPastWeeks,
    defaultFutureWeeks,
    darkMode,
    exerciseGroups,
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
ensureConfigFile();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/config') {
    if (req.method === 'GET') {
      return sendJson(res, 200, readConfig());
    }
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body || '{}');
        const normalized = normalizeConfig(parsed);
        writeConfig(normalized);
        return sendJson(res, 200, normalized);
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

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
