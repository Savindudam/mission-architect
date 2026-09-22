import { setParts, setMission, setTemplates } from './engine/state.js';
import { mountRocketSelect } from './screens/rocketSelect.js';
import { mountBuilder } from './screens/builder.js';
import { mountTrajectory } from './screens/trajectory.js';

async function loadJSON(path, optional = false) {
  const res = await fetch(path);
  if (!res.ok) {
    if (optional) {
      console.warn('[main] optional file missing:', path);
      return null;
    }
    throw new Error('Failed to load ' + path + ': ' + res.status);
  }
  return res.json();
}

const screens = {
  rocketSelect: mountRocketSelect,
  builder: mountBuilder,
  trajectory: mountTrajectory,
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
  const [partsData, templatesData, missionData] = await Promise.all([
    loadJSON('data/core/parts.json'),
    loadJSON('data/core/templates.json'),
    loadJSON('data/missions/mars_orbiter.json', true),
  ]);

  setParts(partsData.parts);
  setTemplates(templatesData.templates);
  if (missionData) setMission(missionData);

  goTo('rocketSelect');
}

init().catch(err => {
  console.error(err);
  document.getElementById('screen').innerHTML =
    '<pre class="screen-error">Boot error:\n' + err.message + '</pre>';
});