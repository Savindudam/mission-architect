import { QUALITY_PRESETS, saveQuality } from '../three/quality.js';

// Full-screen quality picker. Shown on first entry into the builder and
// any time the Graphics button is pressed. Calls onChoose(id) once the
// player commits a tier.

export function showQualityModal(root, current, onChoose) {
  const currentId = current || 'medium';

  const overlay = document.createElement('div');
  overlay.className = 'quality-modal';

  overlay.innerHTML = `
    <div class="quality-panel">
      <div class="quality-kicker">RENDER SETTINGS</div>
      <h1 class="quality-title">CHOOSE GRAPHICS QUALITY</h1>
      <p class="quality-sub">
        Higher settings look better and take longer to load. You can change
        this at any time from the builder.
      </p>

      <div class="quality-grid">
        ${Object.values(QUALITY_PRESETS).map(p => `
          <button class="quality-card ${p.id === currentId ? 'active' : ''}" data-id="${p.id}">
            <div class="quality-name">${p.name}</div>
            <div class="quality-tagline">${p.tagline}</div>
            <div class="quality-desc">${p.description}</div>
            <div class="quality-stats">
              <div class="quality-stat">
                <span class="quality-stat-key">PIXELS</span>
                <span class="quality-stat-val">${p.pixelRatio}x</span>
              </div>
              <div class="quality-stat">
                <span class="quality-stat-key">BLOOM</span>
                <span class="quality-stat-val">${p.bloom.enabled ? (p.bloom.strength * 100).toFixed(0) + '%' : 'OFF'}</span>
              </div>
              <div class="quality-stat">
                <span class="quality-stat-key">SHADOWS</span>
                <span class="quality-stat-val">${p.shadows.enabled ? p.shadows.mapSize : 'OFF'}</span>
              </div>
              <div class="quality-stat">
                <span class="quality-stat-key">PARTICLES</span>
                <span class="quality-stat-val">${p.dustCount}</span>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  root.appendChild(overlay);

  overlay.querySelectorAll('.quality-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      saveQuality(id);
      overlay.remove();
      onChoose(id);
    });
  });
}