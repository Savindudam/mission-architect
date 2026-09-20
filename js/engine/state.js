export const state = {
  user: null,
  mission: null,
  template: null,
  catalogue: [],       // full parts list from data/core/parts.json
  templates: [],       // full template list from data/core/templates.json
  installed: [],       // parts currently in the build
  validation: null,    // output of validate()
  flex: null,          // output of computeFlex()
  launch: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) fn(state);
}

export function setCatalogue(parts) {
  state.catalogue = parts;
  notify();
}

export function setTemplates(templates) {
  state.templates = templates;
  notify();
}

export function setTemplate(template) {
  state.template = template;
  state.installed = [];
  notify();
}

export function setMission(mission) {
  state.mission = mission;
  notify();
}

export function installPart(part) {
  // One part per slot.
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
  const mass = state.installed.reduce((s, p) => s + (p.mass_kg || 0), 0) + (t.baseStructuralMassKg || 0);
  const cost = state.installed.reduce((s, p) => s + (p.cost_usd || 0), 0) + (t.baseCostUsd || 0);
  const power = state.installed.reduce((s, p) => s + (p.power_w || 0), 0);
  return { mass, cost, power };
}