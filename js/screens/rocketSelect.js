import { state, setTemplate } from '../engine/state.js';

export function mountRocketSelect(root) {
  const templates = state.templates || [];

  root.innerHTML = `
    <div class="rocket-select">
      <div class="rs-header">
        <div class="rs-title">SELECT A ROCKET FAMILY</div>
        <div class="rs-subtitle">Every mission starts with a choice. The family determines what you can carry and how far you can go.</div>
      </div>
      <div class="rs-grid" id="rs-grid"></div>
    </div>
  `;

  const grid = root.querySelector('#rs-grid');

  for (const t of templates) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `
      <div class="tc-name">${t.name}</div>
      <div class="tc-desc">${t.description}</div>
      <div class="tc-stats">
        <div class="tc-stat">
          <span class="tc-stat-label">PAYLOAD TO LEO</span>
          <span class="tc-stat-value">${t.payloadToLEOKg.toLocaleString()} kg</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-label">BASE COST</span>
          <span class="tc-stat-value">$${(t.baseCostUsd / 1e6).toFixed(0)}M</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-label">STAGES</span>
          <span class="tc-stat-value">${t.stages}${t.hasBoosters ? ' + boosters' : ''}</span>
        </div>
        <div class="tc-stat">
          <span class="tc-stat-label">MAX SIZE</span>
          <span class="tc-stat-value">${t.sizeClassMax}</span>
        </div>
      </div>
      <div class="tc-tag">Recommended for: ${t.recommendedFor}</div>
    `;
    card.addEventListener('click', () => {
      setTemplate(t);
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'builder' }));    });
    grid.appendChild(card);
  }
}