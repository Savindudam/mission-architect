export const state = {
  user: null,
  mission: null,
  template: null,
  catalogue: [],
  templates: [],
  installed: [],
  validation: null,
  flex: null,
  launch: null,
  trajectory: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) fn(state);
}

// ---- setters ----

export function setMission(mission) {
  state.mission = mission;
  notify();
}

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

export function setValidation(v) {
  state.validation = v;
  notify();
}

export function setFlex(f) {
  state.flex = f;
  notify();
}

// ---- design operations ----

export function installPart(part) {
  // one part per slot — replace whatever was already there
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

// ---- computed totals ----

export function totals() {
  const t = state.template || { baseStructuralMassKg: 0, baseCostUsd: 0 };
  const mass = state.installed.reduce((s, p) => s + (p.mass_kg || 0), 0)
             + (t.baseStructuralMassKg || 0);
  const cost = state.installed.reduce((s, p) => s + (p.cost_usd || 0), 0)
             + (t.baseCostUsd || 0);
  const power = state.installed.reduce((s, p) => s + (p.power_w || 0), 0);
  return { mass, cost, power };
}

// ---- persistence (localStorage) ----

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