// Central store. Every screen reads from here and mutates through the
// exported functions. Do not mutate state directly from a screen.

export const state = {
  // account + mission config
  user: null,
  mission: null,
  destination: 'mars',
  difficulty: 'explorer',
  site: null,
  missionLengthSols: 90,

  // rocket side
  template: null,
  templates: [],
  catalogue: [],
  installed: [],
  validation: null,
  flex: null,

  // launch + trajectory
  launch: null,
  trajectory: null,
  missionStartOffset: null,

  // between rocket and outpost
  payloadRemaining: 0,

  // persistent meters. These follow the player all the way through.
  meters: {
    safety: 70,
    power: 80,
    food: 75,
    science: 0,
    morale: 70,
  },

  // outpost state
  currentSol: 0,
  outpost: {
    modules: [],
    solsRunning: 0,
    eventsLog: [],
  },
  outpostModules: [],

  // end-of-mission report
  report: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) fn(state);
}

// ---------- mission config ----------

export function setMission(mission) {
  state.mission = mission;
  notify();
}

export function setDestination(d) {
  state.destination = d;
  notify();
}

export function setDifficulty(d) {
  state.difficulty = d;
  notify();
}

export function setSite(site) {
  state.site = site;
  notify();
}

// ---------- rocket design ----------

export function setParts(parts) {
  state.catalogue = parts || [];
  notify();
}

export function setCatalogue(parts) {
  state.catalogue = parts || [];
  notify();
}

export function setTemplates(templates) {
  state.templates = templates || [];
  notify();
}

export function setTemplate(template) {
  state.template = template;
  state.installed = [];
  notify();
}

export function installPart(part) {
  // one part per slot; installing a new one replaces whatever was there
  state.installed = state.installed.filter(p => p.slot !== part.slot);
  state.installed.push(part);
  notify();
}

export function removePart(partId) {
  state.installed = state.installed.filter(p => p.id !== partId);
  notify();
}

export function clearDesign() {
  state.installed = [];
  notify();
}

export function setValidation(v) {
  state.validation = v;
  notify();
}

export function setFlex(f) {
  state.flex = f;
  notify();
}

export function totals() {
  const t = state.template || { baseStructuralMassKg: 0, baseCostUsd: 0 };
  const mass = state.installed.reduce((s, p) => s + (p.mass_kg || 0), 0)
             + (t.baseStructuralMassKg || 0);
  const cost = state.installed.reduce((s, p) => s + (p.cost_usd || 0), 0)
             + (t.baseCostUsd || 0);
  const power = state.installed.reduce((s, p) => s + (p.power_w || 0), 0);
  return { mass, cost, power };
}

// ---------- meters ----------

export function adjustMeter(key, delta) {
  if (!(key in state.meters)) return;
  state.meters[key] = clamp(state.meters[key] + delta, 0, 100);
  notify();
}

export function setMeter(key, value) {
  if (!(key in state.meters)) return;
  state.meters[key] = clamp(value, 0, 100);
  notify();
}

export function resetMeters() {
  state.meters = { safety: 70, power: 80, food: 75, science: 0, morale: 70 };
  notify();
}

// ---------- outpost ----------

export function setOutpostModules(modules) {
  state.outpostModules = modules || [];
  notify();
}

export function addModule(def, x, y) {
  state.outpost.modules.push({
    uid: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    moduleId: def.id,
    x, y,
  });
  state.payloadRemaining -= def.mass_kg || 0;
  notify();
}

export function removeModule(uid) {
  const idx = state.outpost.modules.findIndex(m => m.uid === uid);
  if (idx === -1) return;
  const m = state.outpost.modules[idx];
  const def = state.outpostModules.find(d => d.id === m.moduleId);
  if (def) state.payloadRemaining += def.mass_kg || 0;
  state.outpost.modules.splice(idx, 1);
  notify();
}

export function advanceSol() {
  state.currentSol += 1;
  state.outpost.solsRunning += 1;
  notify();
}

export function logEvent(entry) {
  state.outpost.eventsLog.push({ sol: state.currentSol, ...entry });
  if (state.outpost.eventsLog.length > 30) state.outpost.eventsLog.shift();
  notify();
}

// ---------- saved designs ----------

export function saveDesign(name) {
  const saved = JSON.parse(localStorage.getItem('savedRockets') || '{}');
  saved[name] = {
    templateId: state.template?.id || null,
    parts: state.installed.map(p => p.id),
    savedAt: Date.now(),
  };
  localStorage.setItem('savedRockets', JSON.stringify(saved));
}

export function loadSavedRockets() {
  return JSON.parse(localStorage.getItem('savedRockets') || '{}');
}

// ---------- internal ----------

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}