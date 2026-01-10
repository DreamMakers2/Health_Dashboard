const LEGACY_STORAGE_KEY = 'health_dashboard_v1';
const LEGACY_BACKUP_KEY = 'health_dashboard_v1_backup';
const CLIENT_BACKUP_KEY = 'health_dashboard_client_backup';
const CONFIG_BACKUP_KEY = 'health_dashboard_config_backup';
const DEFAULT_WEIGHT = 75;
const DEFAULT_BMI = 22;
const START_DATE = '2025-12-15';
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
const EXERCISE_GROUP_KEYS = ['armsBack', 'coreAbs'];
const WEEKDAY_OPTIONS = [
  { id: 1, short: 'Mon', label: 'Monday' },
  { id: 2, short: 'Tue', label: 'Tuesday' },
  { id: 3, short: 'Wed', label: 'Wednesday' },
  { id: 4, short: 'Thu', label: 'Thursday' },
  { id: 5, short: 'Fri', label: 'Friday' },
  { id: 6, short: 'Sat', label: 'Saturday' },
  { id: 0, short: 'Sun', label: 'Sunday' },
];

let state = null;
let config = null;
let exerciseLookup = null;
let workoutDays = new Set(DEFAULT_CONFIG.scheduleDays);

const scheduleEl = document.getElementById('schedule');
const rangeLabel = document.getElementById('rangeLabel');
const showPastBtn = document.getElementById('showPastBtn');
const showMoreBtn = document.getElementById('showMoreBtn');
const scheduleSubtitle = document.getElementById('scheduleSubtitle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsPanel = document.getElementById('settingsPanel');
const settingsDays = document.getElementById('settingsDays');
const settingsExercises = document.getElementById('settingsExercises');
const settingsHeight = document.getElementById('settingsHeight');
const settingsPastWeeks = document.getElementById('settingsPastWeeks');
const settingsFutureWeeks = document.getElementById('settingsFutureWeeks');
const settingsDarkMode = document.getElementById('settingsDarkMode');
const settingsToast = document.getElementById('settingsToast');
const profileOverlay = document.getElementById('profileOverlay');
const profileHeight = document.getElementById('profileHeight');
const profileWeight = document.getElementById('profileWeight');
const profileWeightRow = document.getElementById('profileWeightRow');
const profileMessage = document.getElementById('profileMessage');
const heightDisplay = document.getElementById('heightDisplay');
const metricDate = document.getElementById('metricDate');
const metricWeight = document.getElementById('metricWeight');
const metricFat = document.getElementById('metricFat');
const metricMuscle = document.getElementById('metricMuscle');
const metricSave = document.getElementById('metricSave');
const metricsTable = document.getElementById('metricsTable');
const yearCalendar = document.getElementById('yearCalendar');
const calendarYearLabel = document.getElementById('calendarYearLabel');

let renderContext = null;
let saveTimer = null;
let configSaveTimer = null;
let scheduleRenderTimer = null;
let toastTimer = null;
let dragState = null;

init().catch((error) => {
  console.error('Init failed', error);
});

async function init() {
  config = await loadConfig();
  applyTheme();
  rebuildExerciseLookup();
  updateWorkoutDays();

  state = await loadState();
  applyAutoToday();

  const todayValue = state.settings.today || getLocalDateISO();
  metricDate.value = todayValue;
  migrateInitialWeightToMetrics();

  if (showPastBtn) {
    showPastBtn.addEventListener('click', () => {
      state.settings.extraPastWeeks = (state.settings.extraPastWeeks || 0) + 1;
      saveState();
      renderSchedule();
    });
  }

  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      state.settings.extraFutureWeeks = (state.settings.extraFutureWeeks || 0) + 1;
      saveState();
      renderSchedule();
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openSettings();
    });
  }

  if (settingsOverlay) {
    settingsOverlay.addEventListener('click', handleSettingsOverlayClick);
  }

  if (settingsPanel) {
    settingsPanel.addEventListener('input', handleSettingsInput);
    settingsPanel.addEventListener('change', handleSettingsChange);
    settingsPanel.addEventListener('click', handleSettingsClick);
    settingsPanel.addEventListener('pointerdown', handleSettingsPointerDown);
    settingsPanel.addEventListener('pointermove', handleSettingsPointerHover);
    settingsPanel.addEventListener('pointerleave', handleSettingsPointerLeave);
  }

  if (profileOverlay) {
    profileOverlay.addEventListener('click', handleProfileOverlayClick);
    profileOverlay.addEventListener('input', handleSettingsInput);
  }

  metricSave.addEventListener('click', () => {
    const isoDate = metricDate.value;
    if (!isoDate) {
      metricDate.focus();
      return;
    }
    state.metrics[isoDate] = {
      weight: metricWeight.value,
      fat: metricFat.value,
      muscle: metricMuscle.value,
    };
    saveState();
    metricWeight.value = '';
    metricFat.value = '';
    metricMuscle.value = '';
    metricDate.value = isoDate;
    renderMetricsTable();
    refreshDayCardEstimates();
    refreshInsights();
    maybeOpenProfilePrompt();
  });

  scheduleEl.addEventListener('click', handleScheduleClick);
  scheduleEl.addEventListener('input', handleScheduleInput);

  metricsTable.addEventListener('input', handleMetricsInput);
  metricsTable.addEventListener('click', handleMetricsClick);

  window.addEventListener('beforeunload', () => {
    saveState();
    flushServerSave();
    flushConfigSave();
  });

  window.addEventListener('resize', () => {
    refreshCharts();
  });

  renderSettingsPanel();
  updateScheduleSubtitle();
  renderHeightDisplay();
  maybeOpenProfilePrompt();

  renderSchedule();
  renderMetricsTable();
  refreshInsights();
}

async function loadConfig() {
  const serverData = await fetchConfigFromServer();
  if (serverData) {
    const normalized = normalizeConfig(serverData);
    writeConfigBackup(normalized);
    return normalized;
  }

  const backup = readConfigBackup();
  if (backup) {
    return normalizeConfig(backup);
  }

  return normalizeConfig(DEFAULT_CONFIG);
}

function saveConfig() {
  if (!config) return;
  writeConfigBackup(config);
  queueConfigSave();
}

function queueConfigSave() {
  if (configSaveTimer) clearTimeout(configSaveTimer);
  const payload = JSON.stringify(config);
  configSaveTimer = setTimeout(() => {
    postConfigToServer(payload);
  }, 400);
}

function flushConfigSave() {
  if (!config) return;
  if (configSaveTimer) {
    clearTimeout(configSaveTimer);
    configSaveTimer = null;
  }
  const payload = JSON.stringify(config);
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/config', blob);
  } else {
    postConfigToServer(payload);
  }
}

async function loadState() {
  const serverData = await fetchStateFromServer();
  if (serverData && !isEmptyState(serverData)) {
    const normalized = normalizeState(serverData);
    writeClientBackup(normalized);
    clearLegacyState();
    return normalized;
  }

  const legacy = readLegacyState();
  if (legacy) {
    const imported = await importStateToServer(legacy);
    const normalized = normalizeState(imported || legacy);
    writeClientBackup(normalized);
    clearLegacyState();
    return normalized;
  }

  const backup = readClientBackup();
  if (backup) {
    const imported = await importStateToServer(backup);
    return normalizeState(imported || backup);
  }

  return defaultState();
}

function saveState() {
  if (!state) return;
  state.lastSaved = new Date().toISOString();
  writeClientBackup(state);
  queueServerSave();
}

function queueServerSave() {
  if (saveTimer) clearTimeout(saveTimer);
  const payload = JSON.stringify(state);
  saveTimer = setTimeout(() => {
    postStateToServer(payload);
  }, 400);
}

function flushServerSave() {
  if (!state) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const payload = JSON.stringify(state);
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/state', blob);
  } else {
    postStateToServer(payload);
  }
}

function defaultState() {
  const today = getLocalDateISO();
  return {
    settings: {
      today,
      lastAutoToday: today,
      extraPastWeeks: 0,
      extraFutureWeeks: 0,
      heightCm: '',
    },
    workouts: {},
    metrics: {},
    customDates: [],
    lastSaved: null,
  };
}

function normalizeState(data) {
  const defaults = defaultState();
  return {
    settings: {
      ...defaults.settings,
      ...(data.settings || {}),
    },
    workouts: data.workouts || {},
    metrics: data.metrics || {},
    customDates: Array.isArray(data.customDates) ? data.customDates : [],
    lastSaved: data.lastSaved || defaults.lastSaved,
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
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

  EXERCISE_GROUP_KEYS.forEach((groupKey) => {
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

function readLocalJSON(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function readLegacyState() {
  return readLocalJSON(LEGACY_STORAGE_KEY) || readLocalJSON(LEGACY_BACKUP_KEY);
}

function clearLegacyState() {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_BACKUP_KEY);
}

function readClientBackup() {
  return readLocalJSON(CLIENT_BACKUP_KEY);
}

function writeClientBackup(data) {
  try {
    localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Client backup failed', error);
  }
}

function readConfigBackup() {
  return readLocalJSON(CONFIG_BACKUP_KEY);
}

function writeConfigBackup(data) {
  try {
    localStorage.setItem(CONFIG_BACKUP_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Config backup failed', error);
  }
}

async function fetchStateFromServer() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function fetchConfigFromServer() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function postStateToServer(payload) {
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
  } catch (error) {
    console.warn('Server save failed', error);
  }
}

async function postConfigToServer(payload) {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
  } catch (error) {
    console.warn('Config save failed', error);
  }
}

async function importStateToServer(data) {
  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('Import failed', error);
    return null;
  }
}

function getLocalDateISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function applyAutoToday() {
  const autoToday = getLocalDateISO();
  state.settings.today = autoToday;
  state.settings.lastAutoToday = autoToday;
  state.settings.extraPastWeeks = 0;
  state.settings.extraFutureWeeks = 0;
  saveState();
}

function applyTheme() {
  if (!config) return;
  document.documentElement.dataset.theme = config.darkMode ? 'dark' : 'light';
}

function updateWorkoutDays() {
  const days = config && Array.isArray(config.scheduleDays) ? config.scheduleDays : DEFAULT_CONFIG.scheduleDays;
  workoutDays = new Set(days);
}

function getExerciseGroups() {
  return config && config.exerciseGroups ? config.exerciseGroups : DEFAULT_CONFIG.exerciseGroups;
}

function getExerciseGroupConfig(groupKey) {
  const groups = getExerciseGroups();
  return groups[groupKey] || { label: groupKey, exercises: [] };
}

function getExerciseList(groupKey) {
  return getExerciseGroupConfig(groupKey).exercises || [];
}

function getExerciseMap(groupKey) {
  if (!exerciseLookup || !exerciseLookup[groupKey]) return {};
  return exerciseLookup[groupKey];
}

function getGroupLabel(groupKey) {
  return getExerciseGroupConfig(groupKey).label || groupKey;
}

function compileFormula(formula) {
  if (!formula || typeof formula !== 'string') return null;
  try {
    const fn = new Function('bw', 'load', `"use strict"; return (${formula});`);
    const test = fn(1, 1);
    if (!Number.isFinite(test)) return null;
    return fn;
  } catch (error) {
    return null;
  }
}

function formulaUsesLoad(formula) {
  if (!formula || typeof formula !== 'string') return false;
  return /\bload\b/.test(formula);
}

function rebuildExerciseLookup() {
  const groups = getExerciseGroups();
  exerciseLookup = {};

  EXERCISE_GROUP_KEYS.forEach((groupKey) => {
    const group = groups[groupKey] || { exercises: [] };
    const map = {};
    group.exercises.forEach((exercise) => {
      const derivedHasWeight = formulaUsesLoad(exercise.kcalFormula);
      if (exercise.hasWeight !== derivedHasWeight) {
        exercise.hasWeight = derivedHasWeight;
      }
      const compiled = compileFormula(exercise.kcalFormula);
      map[exercise.id] = {
        ...exercise,
        hasWeight: derivedHasWeight,
        kcalPerRep: compiled || (() => 0),
        formulaValid: Boolean(compiled),
      };
    });
    exerciseLookup[groupKey] = map;
  });
}

function getDefaultPastWeeks() {
  return config && Number.isFinite(Number(config.defaultPastWeeks))
    ? Number(config.defaultPastWeeks)
    : DEFAULT_CONFIG.defaultPastWeeks;
}

function getDefaultFutureWeeks() {
  return config && Number.isFinite(Number(config.defaultFutureWeeks))
    ? Number(config.defaultFutureWeeks)
    : DEFAULT_CONFIG.defaultFutureWeeks;
}

function parseDate(value) {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day));
}

function getStartDate() {
  return parseDate(START_DATE);
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateNL(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day}-${month}-${year}`;
}

function formatShortDateNL(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day}-${month}`;
}

function formatDisplayDate(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${days[date.getUTCDay()]} - ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatDateLabel(dateStr) {
  const parsed = parseDate(dateStr);
  return parsed ? formatDateNL(parsed) : dateStr;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(date) {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function getTodayDate() {
  if (!state || !state.settings) return parseDate(getLocalDateISO());
  return parseDate(state.settings.today || getLocalDateISO()) || parseDate(getLocalDateISO());
}

function isWorkoutDay(date) {
  return workoutDays.has(date.getUTCDay());
}

function readDayData(dateStr) {
  const stored = state.workouts[dateStr] || {};
  const cycling = stored.cycling || {};
  const walking = stored.walking || {};
  const exerciseData = {};
  EXERCISE_GROUP_KEYS.forEach((groupKey) => {
    exerciseData[groupKey] = normalizeExercises(stored[groupKey] || {}, groupKey);
  });
  return {
    cycling: {
      minutes: cycling.minutes || 0,
      distance: cycling.distance || '',
      calories: cycling.calories || '',
    },
    walking: {
      minutes: walking.minutes || 0,
      distance: walking.distance || '',
      calories: walking.calories || '',
    },
    ...exerciseData,
  };
}

function normalizeExercises(group, groupKey) {
  const list = Array.isArray(group.exercises) ? group.exercises : [];
  const selected = {};
  const legacy = [];
  const exerciseMap = getExerciseMap(groupKey);

  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const exerciseId = item.exercise;
    if (exerciseId && exerciseMap[exerciseId]) {
      selected[exerciseId] = {
        reps: item.reps || '',
        weight: item.weight || '',
      };
      return;
    }
    if (item.name || item.reps || item.weight) {
      legacy.push({
        name: item.name || '',
        reps: item.reps || '',
        weight: item.weight || '',
        index,
      });
    }
  });

  return { selected, legacy };
}

function ensureDayData(dateStr) {
  if (!state.workouts[dateStr]) state.workouts[dateStr] = {};
  const day = state.workouts[dateStr];
  if (!day.cycling) day.cycling = { minutes: 0, distance: '', calories: '' };
  if (!day.walking) day.walking = { minutes: 0, distance: '', calories: '' };
  EXERCISE_GROUP_KEYS.forEach((groupKey) => {
    if (!day[groupKey]) day[groupKey] = { exercises: [] };
    if (!Array.isArray(day[groupKey].exercises)) day[groupKey].exercises = [];
  });
  return day;
}

function buildChips(selectedMinutes) {
  const values = [15, 30, 45, 60];
  return values
    .map((minutes) => {
      const pressed = Number(selectedMinutes) === minutes;
      return `<button class="chip" data-minutes="${minutes}" aria-pressed="${pressed}">${minutes}m</button>`;
    })
    .join('');
}

function buildExerciseChips(groupKey, groupData) {
  const list = getExerciseList(groupKey);
  const selected = groupData && groupData.selected ? groupData.selected : {};
  return list
    .map((exercise) => {
      const pressed = Boolean(selected[exercise.id]);
      return `<button class="chip" data-exercise="${exercise.id}" aria-pressed="${pressed}">${escapeHtml(exercise.label)}</button>`;
    })
    .join('');
}

function getDayStatus(date) {
  const today = renderContext ? renderContext.today : getTodayDate();
  const value = date.getTime();
  if (value === today.getTime()) return 'Today';
  if (value < today.getTime()) return 'Past';
  return 'Upcoming';
}

function getWeekIndex(date) {
  const trainingStart = renderContext ? renderContext.trainingStart : addDays(getTodayDate(), -21);
  const diffDays = Math.floor((date.getTime() - trainingStart.getTime()) / (1000 * 60 * 60 * 24));
  const weekIndex = Math.max(1, Math.floor(diffDays / 7) + 1);
  return `Week ${weekIndex}`;
}

function buildDayCard(dateStr, index) {
  const date = parseDate(dateStr);
  const dayData = readDayData(dateStr);
  const today = renderContext ? renderContext.today : getTodayDate();
  const isToday = date && date.getTime() === today.getTime();
  const isCompleted = hasAnyActivity(dayData);
  const baseStart = renderContext ? renderContext.baseRangeStart : null;
  const baseEnd = renderContext ? renderContext.baseRangeEnd : null;
  const outsideBase = date && ((baseStart && date.getTime() < baseStart.getTime()) || (baseEnd && date.getTime() > baseEnd.getTime()));
  const card = document.createElement('div');
  card.className = 'day-card';
  card.dataset.date = dateStr;
  card.style.setProperty('--i', index);
  if (date && (outsideBase || date.getTime() > today.getTime() || (isCompleted && !isToday))) {
    card.classList.add('collapsed');
  }

  card.innerHTML = `
    <div class="day-header">
      <div>
        <div class="day-title">${formatDisplayDate(date)}</div>
        <div class="day-sub">${getWeekIndex(date)}</div>
      </div>
      <div class="day-header-meta">
        <span class="day-kcal" data-role="day-kcal"></span>
        <div class="day-tag" data-role="day-tag">${getDayStatus(date)}</div>
        <span class="day-toggle" aria-hidden="true">v</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cycling</div>
      <div class="chip-row" data-group="cycling">
        ${buildChips(dayData.cycling.minutes)}
      </div>
      <div class="input-row${dayData.cycling.minutes ? '' : ' is-hidden'}" data-details="cycling">
        <label>
          Distance (km)
          <input type="number" step="0.1" min="0" inputmode="decimal" data-group="cycling" data-field="distance" value="${escapeHtml(dayData.cycling.distance)}">
        </label>
        <label>
          Calories (kcal)
          <input type="number" step="1" min="0" inputmode="numeric" data-group="cycling" data-field="calories" value="${escapeHtml(dayData.cycling.calories)}">
        </label>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Walking</div>
      <div class="chip-row" data-group="walking">
        ${buildChips(dayData.walking.minutes)}
      </div>
      <div class="input-row${dayData.walking.minutes ? '' : ' is-hidden'}" data-details="walking">
        <label>
          Distance (km)
          <input type="number" step="0.1" min="0" inputmode="decimal" data-group="walking" data-field="distance" value="${escapeHtml(dayData.walking.distance)}">
        </label>
        <label>
          Calories (kcal)
          <input type="number" step="1" min="0" inputmode="numeric" data-group="walking" data-field="calories" value="${escapeHtml(dayData.walking.calories)}">
        </label>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(getGroupLabel('armsBack'))}</div>
      <div class="chip-row" data-group="armsBack">
        ${buildExerciseChips('armsBack', dayData.armsBack)}
      </div>
      <div class="exercise-list" data-group="armsBack"></div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(getGroupLabel('coreAbs'))}</div>
      <div class="chip-row" data-group="coreAbs">
        ${buildExerciseChips('coreAbs', dayData.coreAbs)}
      </div>
      <div class="exercise-list" data-group="coreAbs"></div>
    </div>

    <div class="estimate">
      <span>Est. burn</span>
      <strong data-role="estimate">0 kcal</strong>
    </div>
  `;

  renderExerciseList(card, 'armsBack', dayData.armsBack);
  renderExerciseList(card, 'coreAbs', dayData.coreAbs);
  updateEstimateInCard(card, dayData);

  return card;
}

function renderExerciseList(card, group, data) {
  const list = card.querySelector(`.exercise-list[data-group="${group}"]`);
  if (!list) return;
  list.innerHTML = '';
  const exercises = getExerciseList(group);
  const selected = data && data.selected ? data.selected : {};
  const legacy = data && Array.isArray(data.legacy) ? data.legacy : [];
  const hasSelected = exercises.some((exercise) => selected[exercise.id]);
  const hasLegacy = legacy.length > 0;
  list.classList.toggle('is-hidden', !hasSelected && !hasLegacy);

  exercises.forEach((exercise) => {
    const entry = selected[exercise.id];
    if (!entry) return;

    const row = document.createElement('div');
    row.className = `exercise-row${exercise.hasWeight ? '' : ' is-weightless'}`;

    const name = document.createElement('div');
    name.className = 'exercise-name';
    name.textContent = exercise.label;
    row.appendChild(name);

    if (exercise.hasWeight) {
      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.placeholder = 'Weight (kg)';
      weightInput.inputMode = 'decimal';
      weightInput.min = '0';
      weightInput.step = '0.1';
      weightInput.value = entry.weight || '';
      weightInput.dataset.group = group;
      weightInput.dataset.exercise = exercise.id;
      weightInput.dataset.exField = 'weight';
      row.appendChild(weightInput);
    }

    const repsInput = document.createElement('input');
    repsInput.type = 'number';
    repsInput.placeholder = 'Reps';
    repsInput.inputMode = 'numeric';
    repsInput.min = '0';
    repsInput.step = '1';
    repsInput.value = entry.reps || '';
    repsInput.dataset.group = group;
    repsInput.dataset.exercise = exercise.id;
    repsInput.dataset.exField = 'reps';
    row.appendChild(repsInput);

    list.appendChild(row);
  });

  if (hasLegacy) {
    const legacyTitle = document.createElement('div');
    legacyTitle.className = 'exercise-legacy-title';
    legacyTitle.textContent = 'Legacy entries';
    list.appendChild(legacyTitle);

    legacy.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'exercise-row is-legacy';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Exercise';
      nameInput.value = item.name || '';
      nameInput.dataset.group = group;
      nameInput.dataset.legacyIndex = String(item.index);
      nameInput.dataset.exField = 'name';

      const repsInput = document.createElement('input');
      repsInput.type = 'number';
      repsInput.placeholder = 'Reps';
      repsInput.inputMode = 'numeric';
      repsInput.min = '0';
      repsInput.step = '1';
      repsInput.value = item.reps || '';
      repsInput.dataset.group = group;
      repsInput.dataset.legacyIndex = String(item.index);
      repsInput.dataset.exField = 'reps';

      row.appendChild(nameInput);
      row.appendChild(repsInput);
      list.appendChild(row);
    });
  }
}

function renderSchedule() {
  const today = getTodayDate();
  const startDate = getStartDate();
  const defaultPastWeeks = getDefaultPastWeeks();
  const defaultFutureWeeks = getDefaultFutureWeeks();
  const extraPastWeeks = Number(state.settings.extraPastWeeks) || 0;
  const extraFutureWeeks = Number(state.settings.extraFutureWeeks) || 0;
  const baseRangeStart = addDays(today, -(defaultPastWeeks * 7));
  const baseRangeEnd = addDays(today, defaultFutureWeeks * 7);
  const rawStart = addDays(today, -((defaultPastWeeks + extraPastWeeks) * 7));
  const rangeStart = startDate && rawStart.getTime() < startDate.getTime() ? startDate : rawStart;
  const rangeEnd = addDays(today, (defaultFutureWeeks + extraFutureWeeks) * 7);
  const trainingStart = addDays(today, -21);

  const clampedBaseStart = startDate && baseRangeStart.getTime() < startDate.getTime() ? startDate : baseRangeStart;
  renderContext = {
    today,
    rangeStart,
    rangeEnd,
    trainingStart,
    baseRangeStart: clampedBaseStart,
    baseRangeEnd,
  };

  rangeLabel.textContent = `${formatDateNL(rangeStart)} - ${formatDateNL(rangeEnd)}`;

  scheduleEl.innerHTML = '';

  let index = 0;

  const weekStart = startOfWeek(rangeStart);
  const weekEnd = startOfWeek(rangeEnd);

  for (let week = weekStart; week <= weekEnd; week = addDays(week, 7)) {
    const label = getWeekIndex(week);
    const group = createWeekGroup(label);
    let hasDays = false;

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(week, i);
      if (date < rangeStart || date > rangeEnd) continue;
      if (startDate && date.getTime() < startDate.getTime()) continue;
      if (!isWorkoutDay(date)) continue;
      const dateStr = formatDate(date);
      group.appendChild(buildDayCard(dateStr, index));
      index += 1;
      hasDays = true;
    }

    if (hasDays) scheduleEl.appendChild(group);
  }
}

function createWeekGroup(label) {
  const group = document.createElement('div');
  group.className = 'week';
  const header = document.createElement('div');
  header.className = 'week-header';
  header.textContent = label;
  group.appendChild(header);
  return group;
}

function updateEstimateInCard(card, dayData) {
  const dateStr = card.dataset.date;
  const estimate = calculateEstimate(dayData, dateStr);
  const estimateEl = card.querySelector('[data-role="estimate"]');
  if (estimateEl) {
    estimateEl.textContent = `${estimate} kcal`;
  }
  const kcalEl = card.querySelector('[data-role="day-kcal"]');
  if (kcalEl) {
    kcalEl.textContent = `${estimate} kcal`;
  }
  updateCompletionState(card, dayData, dateStr);
}

function setCardioVisibility(card, group, minutes) {
  const row = card.querySelector(`.input-row[data-details="${group}"]`);
  if (!row) return;
  row.classList.toggle('is-hidden', Number(minutes) === 0);
}

function updateCompletionState(card, dayData, dateStr) {
  const date = parseDate(dateStr);
  if (!date) return;
  const today = getTodayDate();
  const isPast = date.getTime() < today.getTime();
  const completed = hasAnyActivity(dayData);
  card.classList.toggle('completed', completed);
  card.classList.toggle('missed', !completed && isPast);

  const tag = card.querySelector('[data-role="day-tag"]');
  if (!tag) return;
  if (completed) tag.textContent = 'Completed';
  else if (isPast) tag.textContent = 'Missed';
  else if (date.getTime() === today.getTime()) tag.textContent = 'Today';
  else tag.textContent = 'Upcoming';
}

function getEstimatedWeightFromHeight() {
  const height = Number(state.settings.heightCm);
  if (!Number.isFinite(height) || height <= 0) return null;
  const meters = height / 100;
  const estimate = meters * meters * DEFAULT_BMI;
  return Math.round(estimate * 10) / 10;
}

function getWeightEntries() {
  return Object.entries(state.metrics)
    .map(([date, data]) => ({
      date,
      parsed: parseDate(date),
      weight: Number(data.weight),
    }))
    .filter((entry) => entry.parsed && Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => a.parsed.getTime() - b.parsed.getTime());
}

function hasMetricsEntry() {
  return Object.values(state.metrics || {}).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return entry.weight !== '' || entry.fat !== '' || entry.muscle !== '';
  });
}

function getFallbackWeight() {
  const estimated = getEstimatedWeightFromHeight();
  if (estimated) return estimated;
  return DEFAULT_WEIGHT;
}

function getWeightForDate(dateStr) {
  const target = dateStr ? parseDate(dateStr) : null;
  const startDate = getStartDate();
  const entries = getWeightEntries();

  if (!entries.length) return getFallbackWeight();

  if (target) {
    const before = entries.filter((entry) => entry.parsed.getTime() <= target.getTime());
    if (before.length) return before[before.length - 1].weight;
    return entries[0].weight;
  }

  return entries[entries.length - 1].weight;
}

function getPreviousExerciseWeight(exerciseId, dateStr) {
  if (!exerciseId || !state || !state.workouts) return '';
  const target = dateStr ? parseDate(dateStr) : null;
  const dates = Object.keys(state.workouts)
    .map((date) => ({ date, parsed: parseDate(date) }))
    .filter((entry) => entry.parsed && (!target || entry.parsed.getTime() < target.getTime()))
    .sort((a, b) => b.parsed.getTime() - a.parsed.getTime());

  for (const entry of dates) {
    const day = state.workouts[entry.date];
    for (const group of EXERCISE_GROUP_KEYS) {
      const list = day && day[group] && Array.isArray(day[group].exercises) ? day[group].exercises : [];
      const match = list.find((item) => item && item.exercise === exerciseId);
      if (match && match.weight !== undefined && match.weight !== null && match.weight !== '') {
        return String(match.weight);
      }
    }
  }

  return '';
}

function minutesToCalories(minutes, weight, met) {
  return minutes * 0.0175 * weight * met;
}

function calculateEstimate(dayData, dateStr) {
  const weightValue = getWeightForDate(dateStr);
  const weight = Number.isFinite(weightValue) && weightValue > 0 ? weightValue : DEFAULT_WEIGHT;
  const cyclingMinutes = Number(dayData.cycling.minutes) || 0;
  const walkingMinutes = Number(dayData.walking.minutes) || 0;
  const cyclingCalories = Number(dayData.cycling.calories);
  const walkingCalories = Number(dayData.walking.calories);

  const cyclingEstimate = cyclingMinutes > 0
    ? (Number.isFinite(cyclingCalories) && cyclingCalories > 0
        ? cyclingCalories
        : minutesToCalories(cyclingMinutes, weight, 7.5))
    : 0;
  const walkingEstimate = walkingMinutes > 0
    ? (Number.isFinite(walkingCalories) && walkingCalories > 0
        ? walkingCalories
        : minutesToCalories(walkingMinutes, weight, 3.5))
    : 0;

  const strengthEstimate = calculateStrengthEstimate(dayData, weight);

  return Math.round(cyclingEstimate + walkingEstimate + strengthEstimate);
}

function calculateStrengthEstimate(dayData, bodyWeight) {
  return EXERCISE_GROUP_KEYS.reduce(
    (sum, groupKey) => sum + estimateExerciseGroup(dayData[groupKey], groupKey, bodyWeight),
    0,
  );
}

function estimateExerciseGroup(groupData, groupKey, bodyWeight) {
  if (!groupData) return 0;
  const exercises = getExerciseList(groupKey);
  const exerciseMap = getExerciseMap(groupKey);
  const selected = groupData.selected || {};
  let total = 0;

  exercises.forEach((exercise) => {
    const entry = selected[exercise.id];
    if (!entry) return;
    const reps = Number(entry.reps) || 0;
    if (reps <= 0) return;
    const load = exercise.hasWeight ? (Number(entry.weight) || 0) : 0;
    const kcalPerRep = exerciseMap[exercise.id] ? exerciseMap[exercise.id].kcalPerRep : null;
    const kcal = kcalPerRep ? kcalPerRep(bodyWeight, load) : 0;
    if (Number.isFinite(kcal)) {
      total += reps * kcal;
    }
  });

  const legacyReps = Array.isArray(groupData.legacy)
    ? groupData.legacy.reduce((sum, item) => sum + (Number(item.reps) || 0), 0)
    : 0;
  if (legacyReps > 0) {
    total += legacyReps * 0.04 * (bodyWeight / DEFAULT_WEIGHT);
  }

  return total;
}

function totalReps(group) {
  if (!group) return 0;
  if (Array.isArray(group.exercises)) {
    return group.exercises.reduce((sum, item) => sum + (Number(item.reps) || 0), 0);
  }
  const selected = group.selected || {};
  const legacy = Array.isArray(group.legacy) ? group.legacy : [];
  const selectedReps = Object.values(selected)
    .reduce((sum, item) => sum + (Number(item.reps) || 0), 0);
  const legacyReps = legacy.reduce((sum, item) => sum + (Number(item.reps) || 0), 0);
  return selectedReps + legacyReps;
}

function hasAnyActivity(dayData) {
  const cyclingMinutes = Number(dayData.cycling.minutes) || 0;
  const walkingMinutes = Number(dayData.walking.minutes) || 0;
  const cyclingActive = cyclingMinutes > 0;
  const walkingActive = walkingMinutes > 0;
  const minutes = cyclingMinutes + walkingMinutes;
  const calories = (cyclingActive ? Number(dayData.cycling.calories) || 0 : 0)
    + (walkingActive ? Number(dayData.walking.calories) || 0 : 0);
  const distance = (cyclingActive ? Number(dayData.cycling.distance) || 0 : 0)
    + (walkingActive ? Number(dayData.walking.distance) || 0 : 0);
  const reps = EXERCISE_GROUP_KEYS.reduce((sum, groupKey) => sum + totalReps(dayData[groupKey]), 0);
  return minutes > 0 || calories > 0 || distance > 0 || reps > 0;
}

function handleScheduleClick(event) {
  const header = event.target.closest('.day-header');
  if (header) {
    const card = header.closest('.day-card');
    if (card) card.classList.toggle('collapsed');
    return;
  }

  const chip = event.target.closest('.chip');
  if (!chip) return;

  const card = chip.closest('.day-card');
  if (!card) return;

  const groupEl = chip.closest('[data-group]');
  if (!groupEl) return;

  const dateStr = card.dataset.date;
  const group = groupEl.dataset.group;
  const minutesValue = chip.dataset.minutes;
  const exerciseId = chip.dataset.exercise;

  if (minutesValue !== undefined) {
    const minutes = Number(minutesValue) || 0;
    const day = ensureDayData(dateStr);
    const current = Number(day[group].minutes) || 0;
    day[group].minutes = current === minutes ? 0 : minutes;

    saveState();

    const chips = groupEl.querySelectorAll('.chip');
    chips.forEach((button) => {
      const value = Number(button.dataset.minutes) || 0;
      const pressed = value === day[group].minutes;
      button.setAttribute('aria-pressed', pressed);
    });

    updateEstimateInCard(card, readDayData(dateStr));
    setCardioVisibility(card, group, day[group].minutes);
    refreshInsights();
    return;
  }

  if (exerciseId !== undefined) {
    const day = ensureDayData(dateStr);
    const groupData = day[group];
    if (!Array.isArray(groupData.exercises)) groupData.exercises = [];
    const existingIndex = groupData.exercises.findIndex((item) => item && item.exercise === exerciseId);

    if (existingIndex >= 0) {
      groupData.exercises.splice(existingIndex, 1);
    } else {
      const exerciseDef = getExerciseMap(group)[exerciseId];
      const entry = { exercise: exerciseId, reps: '', weight: '' };
      if (exerciseDef && exerciseDef.hasWeight) {
        entry.weight = getPreviousExerciseWeight(exerciseId, dateStr);
      }
      groupData.exercises.push(entry);
    }

    saveState();

    const dayData = readDayData(dateStr);
    const chips = groupEl.querySelectorAll('.chip');
    chips.forEach((button) => {
      const id = button.dataset.exercise;
      if (!id) return;
      const pressed = Boolean(dayData[group].selected && dayData[group].selected[id]);
      button.setAttribute('aria-pressed', pressed);
    });

    renderExerciseList(card, group, dayData[group]);
    updateEstimateInCard(card, dayData);
    refreshInsights();
    return;
  }
}

function handleScheduleInput(event) {
  const input = event.target;
  const card = input.closest('.day-card');
  if (!card) return;
  const dateStr = card.dataset.date;

  if (input.dataset.group && input.dataset.field && input.tagName === 'INPUT') {
    const group = input.dataset.group;
    const field = input.dataset.field;
    const day = ensureDayData(dateStr);
    day[group][field] = input.value;
    saveState();
    updateEstimateInCard(card, readDayData(dateStr));
    refreshInsights();
  }

  if (input.dataset.group && input.dataset.exField) {
    const group = input.dataset.group;
    const field = input.dataset.exField;
    const exerciseId = input.dataset.exercise;
    const legacyIndex = input.dataset.legacyIndex;
    const day = ensureDayData(dateStr);
    const groupData = day[group];
    if (!Array.isArray(groupData.exercises)) groupData.exercises = [];

    if (exerciseId) {
      let entry = groupData.exercises.find((item) => item && item.exercise === exerciseId);
      if (!entry) {
        entry = { exercise: exerciseId, reps: '', weight: '' };
        groupData.exercises.push(entry);
      }
      entry[field] = input.value;
    } else if (legacyIndex !== undefined) {
      const index = Number(legacyIndex);
      if (!Number.isNaN(index)) {
        if (!groupData.exercises[index]) groupData.exercises[index] = { name: '', reps: '' };
        groupData.exercises[index][field] = input.value;
      }
    }

    saveState();
    updateEstimateInCard(card, readDayData(dateStr));
    refreshInsights();
  }
}

function openSettings() {
  if (!settingsOverlay) return;
  renderSettingsPanel();
  resetSettingsPosition();
  settingsOverlay.classList.remove('is-hidden');
  settingsOverlay.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  if (!settingsOverlay) return;
  const wasOpen = !settingsOverlay.classList.contains('is-hidden');
  settingsOverlay.classList.add('is-hidden');
  settingsOverlay.setAttribute('aria-hidden', 'true');
  if (wasOpen) showToast('Settings saved');
}

function showToast(message) {
  if (!settingsToast) return;
  settingsToast.textContent = message;
  settingsToast.classList.remove('is-hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    settingsToast.classList.add('is-hidden');
  }, 2000);
}

function resetSettingsPosition() {
  if (!settingsPanel) return;
  settingsPanel.dataset.offsetX = '0';
  settingsPanel.dataset.offsetY = '0';
  settingsPanel.style.transform = 'translate(0px, 0px)';
  settingsPanel.classList.remove('dragging', 'edge-grab');
  dragState = null;
}

function handleSettingsPointerDown(event) {
  if (!settingsPanel || event.button !== 0) return;
  if (!isSettingsEdgeGrab(event)) return;
  event.preventDefault();
  const offsetX = Number(settingsPanel.dataset.offsetX) || 0;
  const offsetY = Number(settingsPanel.dataset.offsetY) || 0;
  dragState = {
    startX: event.clientX,
    startY: event.clientY,
    baseX: offsetX,
    baseY: offsetY,
  };
  settingsPanel.classList.add('dragging');
  window.addEventListener('pointermove', handleSettingsPointerMove);
  window.addEventListener('pointerup', handleSettingsPointerUp, { once: true });
}

function handleSettingsPointerMove(event) {
  if (!dragState || !settingsPanel) return;
  const nextX = dragState.baseX + (event.clientX - dragState.startX);
  const nextY = dragState.baseY + (event.clientY - dragState.startY);
  settingsPanel.dataset.offsetX = String(nextX);
  settingsPanel.dataset.offsetY = String(nextY);
  settingsPanel.style.transform = `translate(${nextX}px, ${nextY}px)`;
}

function handleSettingsPointerUp() {
  if (!settingsPanel) return;
  dragState = null;
  settingsPanel.classList.remove('dragging');
  window.removeEventListener('pointermove', handleSettingsPointerMove);
}

function handleSettingsPointerHover(event) {
  if (!settingsPanel || dragState) return;
  const canGrab = isSettingsEdgeGrab(event);
  settingsPanel.classList.toggle('edge-grab', canGrab);
}

function handleSettingsPointerLeave() {
  if (!settingsPanel || dragState) return;
  settingsPanel.classList.remove('edge-grab');
}

function isSettingsEdgeGrab(event) {
  if (!settingsPanel) return false;
  const rect = settingsPanel.getBoundingClientRect();
  const margin = 14;
  const scrollbarWidth = settingsPanel.offsetWidth - settingsPanel.clientWidth;
  const onScrollbar = scrollbarWidth > 0 && event.clientX >= rect.right - scrollbarWidth;
  if (onScrollbar) return false;
  const onLeft = event.clientX - rect.left <= margin;
  const onRight = rect.right - event.clientX <= margin;
  const onTop = event.clientY - rect.top <= margin;
  const onBottom = rect.bottom - event.clientY <= margin;
  return onLeft || onRight || onTop || onBottom;
}

function handleSettingsOverlayClick(event) {
  if (event.target === settingsOverlay) {
    closeSettings();
  }
}

function handleSettingsClick(event) {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const actionName = action.dataset.action;

  if (actionName === 'close-settings') {
    closeSettings();
    return;
  }

  if (actionName === 'add-exercise') {
    const groupKey = action.dataset.group;
    if (groupKey) addExercise(groupKey);
    return;
  }

  if (actionName === 'remove-exercise') {
    const groupKey = action.dataset.group;
    const exerciseId = action.dataset.exercise;
    if (groupKey && exerciseId) removeExercise(groupKey, exerciseId);
  }
}

function handleSettingsInput(event) {
  const target = event.target;
  if (!target) return;

  const profileField = target.dataset.profileField;
  if (profileField && state && state.settings) {
    setProfileField(profileField, target.value);
    return;
  }

  if (target.dataset.profileWeight !== undefined && state) {
    setProfileWeight(target.value);
    return;
  }

  const configField = target.dataset.configField;
  if (configField && config) {
    if (configField === 'defaultPastWeeks' || configField === 'defaultFutureWeeks') {
      const fallback = DEFAULT_CONFIG[configField];
      config[configField] = clampNumber(target.value, 0, 52, fallback);
      target.value = String(config[configField]);
      saveConfig();
      updateScheduleSubtitle();
      queueScheduleRender();
    }
    return;
  }

  const exerciseField = target.dataset.exerciseField;
  if (exerciseField && config) {
    const groupKey = target.dataset.group;
    const exerciseId = target.dataset.exercise;
    const exercise = getExerciseDefinition(groupKey, exerciseId);
    if (!exercise) return;

    if (exerciseField === 'label') {
      exercise.label = target.value;
      saveConfig();
      queueScheduleRender();
      return;
    }

    if (exerciseField === 'kcalFormula') {
      exercise.kcalFormula = target.value;
      exercise.hasWeight = formulaUsesLoad(exercise.kcalFormula);
      saveConfig();
      rebuildExerciseLookup();
      updateFormulaValidity(target, exercise.kcalFormula);
      queueScheduleRender();
      refreshDayCardEstimates();
      refreshInsights();
    }
  }
}

function handleSettingsChange(event) {
  const target = event.target;
  if (!target || !config) return;

  if (target.dataset.day !== undefined) {
    const dayValue = Number(target.dataset.day);
    const days = new Set(Array.isArray(config.scheduleDays) ? config.scheduleDays : []);
    if (target.checked) {
      days.add(dayValue);
    } else {
      days.delete(dayValue);
      if (!days.size) {
        days.add(dayValue);
        target.checked = true;
      }
    }
    config.scheduleDays = Array.from(days).sort((a, b) => a - b);
    saveConfig();
    updateWorkoutDays();
    updateScheduleSubtitle();
    renderSchedule();
    refreshInsights();
    return;
  }

  const configField = target.dataset.configField;
  if (configField === 'darkMode') {
    config.darkMode = Boolean(target.checked);
    saveConfig();
    applyTheme();
    refreshCharts();
    return;
  }
}

function renderSettingsPanel() {
  if (!settingsPanel) return;
  syncProfileInputs();

  if (settingsPastWeeks) {
    settingsPastWeeks.value = String(getDefaultPastWeeks());
  }
  if (settingsFutureWeeks) {
    settingsFutureWeeks.value = String(getDefaultFutureWeeks());
  }
  if (settingsDarkMode) {
    settingsDarkMode.checked = Boolean(config && config.darkMode);
  }

  renderScheduleDaysControls();
  renderExerciseSettings();
}

function renderScheduleDaysControls() {
  if (!settingsDays) return;
  settingsDays.innerHTML = '';
  const selectedDays = new Set(config && Array.isArray(config.scheduleDays) ? config.scheduleDays : []);

  WEEKDAY_OPTIONS.forEach((day) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'day-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.day = String(day.id);
    input.checked = selectedDays.has(day.id);

    const text = document.createElement('span');
    text.textContent = day.short;

    wrapper.appendChild(input);
    wrapper.appendChild(text);
    settingsDays.appendChild(wrapper);
  });
}

function renderExerciseSettings() {
  if (!settingsExercises) return;
  settingsExercises.innerHTML = '';
  const groups = getExerciseGroups();

  EXERCISE_GROUP_KEYS.forEach((groupKey) => {
    const group = groups[groupKey] || { label: groupKey, exercises: [] };
    const card = document.createElement('div');
    card.className = 'settings-group';

    const header = document.createElement('div');
    header.className = 'settings-group-header';

    const title = document.createElement('div');
    title.className = 'settings-group-title';
    title.textContent = group.label;

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn ghost small';
    addButton.dataset.action = 'add-exercise';
    addButton.dataset.group = groupKey;
    addButton.textContent = 'Add exercise';

    header.appendChild(title);
    header.appendChild(addButton);
    card.appendChild(header);

    const list = document.createElement('div');
    list.className = 'settings-exercise-list';

    group.exercises.forEach((exercise) => {
      const row = document.createElement('div');
      row.className = 'settings-exercise-row';
      row.dataset.group = groupKey;
      row.dataset.exercise = exercise.id;

      const headerRow = document.createElement('div');
      headerRow.className = 'exercise-row-header';

      const nameLabel = document.createElement('label');
      nameLabel.className = 'exercise-field name';
      nameLabel.textContent = 'Name';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = exercise.label;
      nameInput.dataset.exerciseField = 'label';
      nameInput.dataset.group = groupKey;
      nameInput.dataset.exercise = exercise.id;
      nameLabel.appendChild(nameInput);

      const formulaLabel = document.createElement('label');
      formulaLabel.className = 'exercise-field formula';
      const formulaHeader = document.createElement('div');
      formulaHeader.className = 'exercise-field-header';
      const formulaTitle = document.createElement('span');
      formulaTitle.textContent = 'Formula (kcal/rep)';
      formulaHeader.appendChild(formulaTitle);
      const formulaInput = document.createElement('textarea');
      formulaInput.rows = 1;
      formulaInput.value = exercise.kcalFormula;
      formulaInput.placeholder = '0.006 * (load + 0.1 * bw)';
      formulaInput.dataset.exerciseField = 'kcalFormula';
      formulaInput.dataset.group = groupKey;
      formulaInput.dataset.exercise = exercise.id;

      const formulaStatus = document.createElement('div');
      formulaStatus.className = 'formula-status';
      formulaStatus.dataset.role = 'formula-status';
      formulaHeader.appendChild(formulaStatus);

      formulaLabel.appendChild(formulaHeader);
      formulaLabel.appendChild(formulaInput);

      updateFormulaValidity(formulaInput, exercise.kcalFormula);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn ghost small danger exercise-remove';
      removeButton.dataset.action = 'remove-exercise';
      removeButton.dataset.group = groupKey;
      removeButton.dataset.exercise = exercise.id;
      removeButton.textContent = 'Remove';

      headerRow.appendChild(nameLabel);
      headerRow.appendChild(removeButton);

      row.appendChild(headerRow);
      row.appendChild(formulaLabel);
      list.appendChild(row);
    });

    card.appendChild(list);
    settingsExercises.appendChild(card);
  });
}

function updateFormulaValidity(input, formula) {
  if (!input) return;
  const valid = Boolean(compileFormula(formula));
  input.classList.toggle('is-invalid', !valid);
  const status = input.parentElement ? input.parentElement.querySelector('[data-role="formula-status"]') : null;
  if (status) {
    status.textContent = valid ? 'Valid' : 'Invalid formula';
    status.classList.toggle('invalid', !valid);
  }
}

function getExerciseDefinition(groupKey, exerciseId) {
  const group = getExerciseGroupConfig(groupKey);
  return (group.exercises || []).find((exercise) => exercise.id === exerciseId);
}

function addExercise(groupKey) {
  const group = getExerciseGroupConfig(groupKey);
  const label = 'New exercise';
  const id = createExerciseId(groupKey, label);
  group.exercises.push({
    id,
    label,
    hasWeight: formulaUsesLoad(DEFAULT_WEIGHTED_FORMULA),
    kcalFormula: DEFAULT_WEIGHTED_FORMULA,
  });
  saveConfig();
  rebuildExerciseLookup();
  renderExerciseSettings();
  renderSchedule();
  refreshInsights();
}

function removeExercise(groupKey, exerciseId) {
  const group = getExerciseGroupConfig(groupKey);
  const index = group.exercises.findIndex((exercise) => exercise.id === exerciseId);
  if (index < 0) return;
  const removed = group.exercises[index];
  const ok = window.confirm(`Remove "${removed.label}"? Logged reps stay as legacy entries.`);
  if (!ok) return;
  group.exercises.splice(index, 1);
  migrateExerciseToLegacy(groupKey, exerciseId, removed.label);
  saveConfig();
  saveState();
  rebuildExerciseLookup();
  renderExerciseSettings();
  renderSchedule();
  refreshInsights();
}

function migrateExerciseToLegacy(groupKey, exerciseId, label) {
  Object.keys(state.workouts || {}).forEach((date) => {
    const day = state.workouts[date];
    if (!day || !day[groupKey] || !Array.isArray(day[groupKey].exercises)) return;
    day[groupKey].exercises.forEach((item) => {
      if (!item || item.exercise !== exerciseId) return;
      item.name = item.name || label;
      delete item.exercise;
    });
  });
}

function createExerciseId(groupKey, label) {
  const base = slugify(label) || 'exercise';
  const existing = new Set(getExerciseList(groupKey).map((exercise) => exercise.id));
  if (!existing.has(base)) return base;
  let index = 2;
  let candidate = `${base}-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }
  return candidate;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function queueScheduleRender() {
  if (scheduleRenderTimer) clearTimeout(scheduleRenderTimer);
  scheduleRenderTimer = setTimeout(() => {
    renderSchedule();
    refreshInsights();
  }, 200);
}

function updateScheduleSubtitle() {
  if (!scheduleSubtitle) return;
  const days = formatScheduleDays();
  const past = getDefaultPastWeeks();
  const future = getDefaultFutureWeeks();
  const pastLabel = past === 1 ? 'week' : 'weeks';
  const futureLabel = future === 1 ? 'week' : 'weeks';
  scheduleSubtitle.textContent = `${days} schedule. Past ${past} ${pastLabel} + next ${future} ${futureLabel}.`;
}

function formatScheduleDays() {
  const selected = new Set(config && Array.isArray(config.scheduleDays) ? config.scheduleDays : DEFAULT_CONFIG.scheduleDays);
  const labels = WEEKDAY_OPTIONS.filter((day) => selected.has(day.id)).map((day) => day.short);
  return labels.length ? labels.join('/') : 'No days';
}

function syncProfileInputs() {
  if (!state || !state.settings) return;
  const heightValue = state.settings.heightCm || '';

  if (settingsHeight) settingsHeight.value = heightValue;
  if (profileHeight) profileHeight.value = heightValue;
  if (profileWeight) profileWeight.value = '';
}

function renderHeightDisplay() {
  if (!heightDisplay || !state || !state.settings) return;
  const height = Number(state.settings.heightCm);
  if (Number.isFinite(height) && height > 0) {
    heightDisplay.textContent = String(height);
  } else {
    heightDisplay.textContent = 'Not set';
  }
}

function getProfileNeeds() {
  const height = Number(state.settings.heightCm);
  const needsHeight = !(Number.isFinite(height) && height > 0);
  const needsWeight = !hasMetricsEntry();
  return { needsHeight, needsWeight };
}

function updateProfilePrompt() {
  if (!profileOverlay) return;
  const { needsHeight, needsWeight } = getProfileNeeds();
  if (profileWeightRow) {
    profileWeightRow.classList.toggle('is-hidden', !needsWeight);
  }
  if (profileMessage) {
    if (needsHeight && needsWeight) {
      profileMessage.textContent = 'Height and a starting weight (body metrics entry) improve kcal estimates.';
    } else if (needsHeight) {
      profileMessage.textContent = 'Height helps estimate kcal burn when logs are missing.';
    } else if (needsWeight) {
      profileMessage.textContent = 'Add a starting weight (body metrics entry) to improve kcal estimates.';
    } else {
      profileMessage.textContent = 'Profile complete.';
    }
  }
}

function maybeOpenProfilePrompt() {
  if (!profileOverlay) return;
  const { needsHeight, needsWeight } = getProfileNeeds();
  updateProfilePrompt();
  if (!needsHeight && !needsWeight) {
    closeProfilePrompt();
    return;
  }
  openProfilePrompt();
}

function openProfilePrompt() {
  if (!profileOverlay) return;
  syncProfileInputs();
  updateProfilePrompt();
  profileOverlay.classList.remove('is-hidden');
  profileOverlay.setAttribute('aria-hidden', 'false');
}

function closeProfilePrompt() {
  if (!profileOverlay) return;
  profileOverlay.classList.add('is-hidden');
  profileOverlay.setAttribute('aria-hidden', 'true');
}

function handleProfileOverlayClick(event) {
  if (!profileOverlay) return;
  const action = event.target.closest('[data-action]');
  if (action) {
    const actionName = action.dataset.action;
    if (actionName === 'close-profile') {
      closeProfilePrompt();
      return;
    }
    if (actionName === 'open-settings') {
      closeProfilePrompt();
      openSettings();
      return;
    }
  }
  if (event.target === profileOverlay) {
    closeProfilePrompt();
  }
}

function setProfileField(field, value) {
  state.settings[field] = value;
  saveState();
  syncProfileInputs();
  renderHeightDisplay();
  refreshDayCardEstimates();
  refreshInsights();
  updateProfilePrompt();
  const { needsHeight, needsWeight } = getProfileNeeds();
  if (!needsHeight && !needsWeight) {
    closeProfilePrompt();
  }
}

function setProfileWeight(value) {
  const isoDate = (metricDate && metricDate.value) ? metricDate.value : getLocalDateISO();
  if (!isoDate) return;
  if (!state.metrics[isoDate]) state.metrics[isoDate] = { weight: '', fat: '', muscle: '' };
  state.metrics[isoDate].weight = value;
  saveState();
  renderMetricsTable();
  refreshDayCardEstimates();
  refreshInsights();
  updateProfilePrompt();
  const { needsHeight, needsWeight } = getProfileNeeds();
  if (!needsHeight && !needsWeight) {
    closeProfilePrompt();
  }
}

function migrateInitialWeightToMetrics() {
  if (!state || !state.settings) return;
  const legacyWeight = Number(state.settings.initialWeightKg);
  if (!Number.isFinite(legacyWeight) || legacyWeight <= 0) return;
  if (hasMetricsEntry()) {
    state.settings.initialWeightKg = '';
    saveState();
    return;
  }
  const isoDate = (metricDate && metricDate.value) ? metricDate.value : getLocalDateISO();
  if (!isoDate) return;
  if (!state.metrics[isoDate]) state.metrics[isoDate] = { weight: '', fat: '', muscle: '' };
  if (!state.metrics[isoDate].weight) state.metrics[isoDate].weight = String(legacyWeight);
  state.settings.initialWeightKg = '';
  saveState();
}

function renderMetricsTable() {
  const startDate = getStartDate();
  const entries = Object.entries(state.metrics)
    .map(([date, data]) => ({
      date,
      weight: data.weight || '',
      fat: data.fat || '',
      muscle: data.muscle || '',
    }))
    .filter((entry) => {
      const parsed = parseDate(entry.date);
      return !startDate || (parsed && parsed.getTime() >= startDate.getTime());
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  metricsTable.innerHTML = '';

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'panel-sub';
    empty.textContent = 'No entries yet. Add your first body metrics above.';
    metricsTable.appendChild(empty);
    return;
  }

  entries.slice(0, 12).forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'metrics-row';
    row.dataset.date = entry.date;
    row.innerHTML = `
      <div class="date">${formatDateLabel(entry.date)}</div>
      <input type="number" step="0.1" min="0" data-field="weight" value="${escapeHtml(entry.weight)}">
      <input type="number" step="0.1" min="0" max="100" data-field="fat" value="${escapeHtml(entry.fat)}">
      <input type="number" step="0.1" min="0" max="100" data-field="muscle" value="${escapeHtml(entry.muscle)}">
      <div class="metrics-actions">
        <button data-action="remove">Remove</button>
        <div class="metrics-confirm">
          <span>Remove?</span>
          <button data-action="confirm-remove">Yes</button>
          <button data-action="cancel-remove">No</button>
        </div>
      </div>
    `;
    metricsTable.appendChild(row);
  });
}

function handleMetricsInput(event) {
  const input = event.target;
  if (!input.dataset.field) return;
  const row = input.closest('.metrics-row');
  if (!row) return;
  const date = row.dataset.date;
  if (!state.metrics[date]) state.metrics[date] = { weight: '', fat: '', muscle: '' };
  state.metrics[date][input.dataset.field] = input.value;
  saveState();
  refreshDayCardEstimates();
  refreshInsights();
  maybeOpenProfilePrompt();
}

function handleMetricsClick(event) {
  const row = event.target.closest('.metrics-row');
  if (!row) return;

  const removeButton = event.target.closest('button[data-action="remove"]');
  if (removeButton) {
    row.classList.add('confirming');
    return;
  }

  const confirmButton = event.target.closest('button[data-action="confirm-remove"]');
  if (confirmButton) {
    const date = row.dataset.date;
    delete state.metrics[date];
    saveState();
    renderMetricsTable();
    refreshDayCardEstimates();
    refreshInsights();
    maybeOpenProfilePrompt();
    return;
  }

  const cancelButton = event.target.closest('button[data-action="cancel-remove"]');
  if (cancelButton) {
    row.classList.remove('confirming');
  }
}

function renderSummary() {
  const today = getTodayDate();
  const start = addDays(today, -6);
  const startDate = getStartDate();

  let planned = 0;
  let completed = 0;
  let cyclingMinutes = 0;
  let walkingMinutes = 0;
  let estimatedBurn = 0;

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    if (startDate && date.getTime() < startDate.getTime()) continue;
    if (isWorkoutDay(date)) planned += 1;
    const dateStr = formatDate(date);
    const dayData = readDayData(dateStr);
    if (hasAnyActivity(dayData)) completed += 1;
    cyclingMinutes += Number(dayData.cycling.minutes) || 0;
    walkingMinutes += Number(dayData.walking.minutes) || 0;
    estimatedBurn += calculateEstimate(dayData, dateStr);
  }

  setSummary('workouts7', `${completed}/${planned}`);
  setSummary('workouts7Sub', `${planned} planned`);
  setSummary('cardio7', `${Math.round(cyclingMinutes + walkingMinutes)} min`);
  setSummary('burn7', `${Math.round(estimatedBurn)} kcal`);

  const metrics = Object.entries(state.metrics)
    .map(([date, data]) => ({
      date,
      weight: Number(data.weight),
    }))
    .filter((entry) => !Number.isNaN(entry.weight))
    .filter((entry) => {
      const parsed = parseDate(entry.date);
      return !startDate || (parsed && parsed.getTime() >= startDate.getTime());
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const recentMetrics = metrics.filter((entry) => {
    const date = parseDate(entry.date);
    return date && date.getTime() <= today.getTime();
  });

  const latest = recentMetrics[recentMetrics.length - 1];
  const deltaStart = addDays(today, -14);
  const earliest = recentMetrics.find((entry) => {
    const date = parseDate(entry.date);
    return date && date.getTime() >= deltaStart.getTime();
  });

  if (latest) {
    setSummary('weightLatest', `${latest.weight.toFixed(1)} kg`);
    if (earliest && earliest.weight !== latest.weight) {
      const delta = latest.weight - earliest.weight;
      const sign = delta >= 0 ? '+' : '-';
      setSummary('weightDelta', `${sign}${Math.abs(delta).toFixed(1)} kg over 14d`);
    } else {
      setSummary('weightDelta', 'No recent delta');
    }
  } else {
    setSummary('weightLatest', '--');
    setSummary('weightDelta', 'No data yet');
  }
}

function renderYearCalendar() {
  if (!yearCalendar) return;
  const today = getTodayDate();
  const year = today.getUTCFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const firstCompleted = getFirstCompletedDate();
  const startDate = getStartDate();

  const includeDec2025 = year >= 2026;

  if (calendarYearLabel) {
    calendarYearLabel.textContent = 'calendar';
  }

  yearCalendar.innerHTML = '';

  const monthList = [];
  if (includeDec2025) {
    monthList.push({ year: 2025, month: 11, label: 'Dec 2025' });
  }
  for (let month = 0; month < 12; month += 1) {
    monthList.push({ year, month, label: months[month] });
  }

  monthList.forEach((entry) => {
    const monthCard = document.createElement('div');
    monthCard.className = 'month-card';

    const title = document.createElement('div');
    title.className = 'month-title';
    title.textContent = entry.label;

    const grid = document.createElement('div');
    grid.className = 'month-grid';

    const firstDate = new Date(Date.UTC(entry.year, entry.month, 1));
    const daysInMonth = new Date(Date.UTC(entry.year, entry.month + 1, 0)).getUTCDate();
    const offset = (firstDate.getUTCDay() + 6) % 7;

    for (let i = 0; i < offset; i += 1) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(entry.year, entry.month, day));
      const dateStr = formatDate(date);
      const cell = document.createElement('div');
      cell.className = 'cal-day off';

      if (startDate && date.getTime() < startDate.getTime()) {
        grid.appendChild(cell);
        continue;
      }
      if (isWorkoutDay(date)) {
        const dayData = readDayData(dateStr);
        const completed = hasAnyActivity(dayData);
        const isPast = date.getTime() < today.getTime();
        const allowMissed = firstCompleted && date.getTime() >= firstCompleted.getTime();
        cell.className = 'cal-day workout';
        if (completed) cell.classList.add('completed');
        else if (isPast && allowMissed) cell.classList.add('missed');
        else if (!isPast) cell.classList.add('scheduled');
        const status = completed
          ? 'Completed'
          : (isPast ? (allowMissed ? 'Missed' : 'Planned') : 'Scheduled');
        cell.title = `${formatDateNL(date)} - ${status}`;
      }

      grid.appendChild(cell);
    }

    monthCard.appendChild(title);
    monthCard.appendChild(grid);
    yearCalendar.appendChild(monthCard);
  });
}

function setSummary(key, value) {
  const el = document.querySelector(`[data-summary="${key}"]`);
  if (el) el.textContent = value;
}

function refreshInsights() {
  renderSummary();
  renderYearCalendar();
  refreshCharts();
}

function refreshDayCardEstimates() {
  const cards = scheduleEl.querySelectorAll('.day-card');
  cards.forEach((card) => {
    const dateStr = card.dataset.date;
    if (!dateStr) return;
    updateEstimateInCard(card, readDayData(dateStr));
  });
}

function getFirstCompletedDate() {
  const startDate = getStartDate();
  const dates = Object.keys(state.workouts || {});
  let first = null;
  dates.forEach((dateStr) => {
    const dayData = readDayData(dateStr);
    if (!hasAnyActivity(dayData)) return;
    const date = parseDate(dateStr);
    if (!date) return;
    if (startDate && date.getTime() < startDate.getTime()) return;
    if (!first || date.getTime() < first.getTime()) {
      first = date;
    }
  });
  return first;
}

function refreshCharts() {
  drawBodyChart();
  drawCalorieChart();
}

function drawBodyChart() {
  const canvas = document.getElementById('bodyChart');
  const ctx = setupCanvas(canvas);
  if (!ctx) return;

  const { width, height } = canvas.getBoundingClientRect();
  const padding = { top: 16, right: 32, bottom: 40, left: 32 };

  const points = getMetricPoints();
  if (points.length < 2) {
    drawEmptyState(ctx, width, height, 'Add metrics to see progress');
    return;
  }

  const weightValues = points.map((p) => p.weight).filter((v) => Number.isFinite(v));
  if (weightValues.length < 2) {
    drawEmptyState(ctx, width, height, 'Weight data needed');
    return;
  }

  const weightMin = Math.min(...weightValues);
  const weightMax = Math.max(...weightValues);
  const weightRange = weightMax - weightMin || 1;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xStep = chartWidth / (points.length - 1);

  const colors = getThemeColors();

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  drawSeries(ctx, points, padding, chartWidth, chartHeight, xStep, (p) => p.weight, weightMin, weightRange, colors.accent);
  drawSeries(ctx, points, padding, chartWidth, chartHeight, xStep, (p) => p.fat, 0, 100, colors.accent2);
  drawSeries(ctx, points, padding, chartWidth, chartHeight, xStep, (p) => p.muscle, 0, 100, colors.accent3);

  ctx.fillStyle = colors.muted;
  ctx.font = '9px Instrument Sans';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  points.forEach((point, index) => {
    const label = formatShortDateNL(point.date);
    const x = padding.left + xStep * index;
    const y = height - 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function drawCalorieChart() {
  const canvas = document.getElementById('calorieChart');
  const ctx = setupCanvas(canvas);
  if (!ctx) return;

  const { width, height } = canvas.getBoundingClientRect();
  const padding = { top: 16, right: 16, bottom: 40, left: 32 };

  const data = getCaloriePoints();
  if (!data.length) {
    drawEmptyState(ctx, width, height, 'Log workouts to see output');
    return;
  }

  const maxValue = Math.max(...data.map((item) => item.value)) || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const slotWidth = chartWidth / data.length;
  const barWidth = slotWidth * 0.6;

  const colors = getThemeColors();

  ctx.clearRect(0, 0, width, height);

  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
    const y = padding.top + chartHeight - barHeight;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x, y, barWidth, barHeight);
  });

  ctx.fillStyle = colors.muted;
  ctx.font = '9px Instrument Sans';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  data.forEach((item, index) => {
    const x = padding.left + slotWidth * index + slotWidth / 2;
    const y = height - 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(item.label, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function setupCanvas(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawSeries(ctx, points, padding, chartWidth, chartHeight, xStep, getValue, min, range, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;

  points.forEach((point, index) => {
    const value = getValue(point);
    if (!Number.isFinite(value)) {
      started = false;
      return;
    }
    const x = padding.left + xStep * index;
    const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function drawEmptyState(ctx, width, height, message) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getThemeColors().muted;
  ctx.font = '12px Instrument Sans';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

function getMetricPoints() {
  const today = getTodayDate();
  const cutoff = addDays(today, -30);
  const startDate = getStartDate();
  const floor = startDate && startDate.getTime() > cutoff.getTime() ? startDate : cutoff;
  return Object.entries(state.metrics)
    .map(([date, data]) => ({
      date: parseDate(date),
      weight: Number(data.weight),
      fat: Number(data.fat),
      muscle: Number(data.muscle),
    }))
    .filter((entry) => entry.date && entry.date.getTime() >= floor.getTime() && entry.date.getTime() <= today.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getCaloriePoints() {
  const startDate = getStartDate();
  const entries = Object.keys(state.workouts)
    .sort()
    .map((date) => {
      const dayData = readDayData(date);
      const estimate = calculateEstimate(dayData, date);
      return { date, value: estimate };
    })
    .filter((entry) => entry.value > 0)
    .filter((entry) => {
      const parsed = parseDate(entry.date);
      return !startDate || (parsed && parsed.getTime() >= startDate.getTime());
    });

  const trimmed = entries.slice(-10);

  return trimmed.map((entry) => ({
    label: formatShortDateNL(parseDate(entry.date)),
    value: entry.value,
  }));
}

function getThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: styles.getPropertyValue('--accent').trim(),
    accent2: styles.getPropertyValue('--accent-2').trim(),
    accent3: styles.getPropertyValue('--accent-3').trim(),
    line: styles.getPropertyValue('--line').trim(),
    muted: styles.getPropertyValue('--muted').trim(),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
