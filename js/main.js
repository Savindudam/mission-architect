import { setParts, setTemplates } from './engine/state.js';
import { mountMissions } from './screens/missions.js';
import { mountFlight } from './screens/flight.js';
import { mountRocketSelect } from './screens/rocketSelect.js';
import { mountBuilder } from './screens/builder.js';

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to load ' + path + ': ' + res.status);
  return res.json();
}

import { mountDebrief } from './screens/debrief.js';

import { mountLanding } from './screens/landing.js';

const screens = {
  missions: mountMissions,
  rocketSelect: mountRocketSelect,
  builder: mountBuilder,
  flight: mountFlight,
  landing: mountLanding,   // <— new
  debrief: mountDebrief,
};

function goTo(name) {
  const root = document.getElementById('screen');
  root.innerHTML = '';
  const mount = screens[name];
  if (!mount) {
    root.innerHTML = '<pre class="screen-error">Screen "' + name + '" not implemented.</pre>';
    return;
  }
  Promise.resolve(mount(root)).catch(err => {
    console.error(err);
    root.innerHTML = '<pre class="screen-error">Error in ' + name + ':\n' + err.message + '</pre>';
  });
  const label = document.getElementById('screen-label');
  if (label) label.textContent = name.toUpperCase();
}

window.addEventListener('navigate', (e) => goTo(e.detail));

async function init() {
  const [partsData, templatesData] = await Promise.all([
    loadJSON('data/core/parts.json'),
    loadJSON('data/core/templates.json'),
  ]);

  setParts(partsData.parts);
  setTemplates(templatesData.templates);

  goTo('missions');
}

init().catch(err => {
  console.error(err);
  document.getElementById('screen').innerHTML =
    '<pre class="screen-error">Boot error:\n' + err.message + '</pre>';
});