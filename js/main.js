import { setCatalogue, setTemplates } from './engine/state.js';
import { mountRocketSelect } from './screens/rocketSelect.js';
import { mountBuilder } from './screens/builder.js';

const screens = {
  rocketSelect: mountRocketSelect,
  builder: mountBuilder,
};

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to load ' + path + ': ' + res.status);
  return res.json();
}

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
  setCatalogue(partsData.parts);
  setTemplates(templatesData.templates);
  goTo('rocketSelect');
}

init().catch(err => {
  console.error(err);
  document.getElementById('screen').innerHTML =
    '<pre class="screen-error">Boot error:\n' + err.message + '\n\nAre you serving from a local server?</pre>';
});