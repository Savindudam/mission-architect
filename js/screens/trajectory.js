import { state } from '../engine/state.js';
import { CONST, departureDeltaV, hohmannDays, synodicDays, solarFlux } from '../engine/derived.js';

export async function mountTrajectory(root) {
  const mission = state.mission || {};
  const bodies = await loadBodies();

  // Find target planet by name
  const targetName = (mission.destination || 'Mars').toLowerCase();
  const target = bodies.find(b => b.id === targetName || b.name.toLowerCase() === targetName) || bodies.find(b => b.id === 'mars');

  if (!target) {
    root.innerHTML = '<pre class="screen-error">Target planet not found in bodies.json</pre>';
    return;
  }

  // Rocket delta-V available
  const dvAvailable = computeAvailableDeltaV(state.template, state.installed);
  const dryMass = computeDryMass(state.template, state.installed);

  // Target's Hohmann values
  const dvHohmann = departureDeltaV(target.aAU);
  const flightDaysHohmann = hohmannDays(target.aAU);
  const windowDays = synodicDays(target.aAU);

  // Player state
  const params = {
    launchDay: Math.round(windowDays * 0.35),  // default to near-optimal
    transferMode: 0.5,  // 0 = cheap, 1 = fast
  };

  root.innerHTML = `
    <div class="trajectory-screen">
      <div class="trajectory-canvas-wrap">
        <canvas id="trajectory-canvas"></canvas>
        <div class="trajectory-overlay">
          <div class="trajectory-title">TRAJECTORY PLANNER</div>
          <div class="trajectory-subtitle" id="tr-subtitle">TARGET: ${target.name.toUpperCase()}</div>
        </div>
        <div class="trajectory-legend">
          <span><i class="dot-sun"></i> SUN</span>
          <span><i class="dot-earth"></i> EARTH</span>
          <span><i class="dot-target"></i> ${target.name.toUpperCase()}</span>
          <span><i class="dot-path"></i> TRAJECTORY</span>
        </div>
      </div>

      <aside class="trajectory-side">
        <h2 class="tr-h2">LAUNCH WINDOW</h2>
        <div class="tr-slider-group">
          <div class="tr-slider-label">
            <span>DEPARTURE DATE</span>
            <span id="tr-day-val">DAY 0</span>
          </div>
          <input type="range" id="tr-day-slider" min="0" max="${Math.round(windowDays)}" value="${Math.round(windowDays * 0.35)}" step="1" />
          <div class="tr-slider-hint">Optimal window: day ${Math.round(windowDays * 0.35)}</div>
        </div>

        <h2 class="tr-h2">TRANSFER MODE</h2>
        <div class="tr-slider-group">
          <div class="tr-slider-label">
            <span>CHEAP ← → FAST</span>
            <span id="tr-mode-val">BALANCED</span>
          </div>
          <input type="range" id="tr-mode-slider" min="0" max="100" value="50" step="1" />
          <div class="tr-slider-hint">Fast transfers burn more fuel but arrive sooner</div>
        </div>

        <h2 class="tr-h2">PREDICTION</h2>
        <div class="tr-prediction" id="tr-prediction"></div>

        <div class="tr-hazards" id="tr-hazards"></div>

        <div class="tr-actions">
          <button class="btn-secondary" id="tr-back">BACK TO BUILDER</button>
          <button class="btn-primary" id="tr-launch" disabled>LAUNCH</button>
        </div>
      </aside>
    </div>
  `;

  const canvas = root.querySelector('#trajectory-canvas');
  const ctx = canvas.getContext('2d');
  const daySlider = root.querySelector('#tr-day-slider');
  const modeSlider = root.querySelector('#tr-mode-slider');
  const launchBtn = root.querySelector('#tr-launch');
  const predictionEl = root.querySelector('#tr-prediction');
  const hazardsEl = root.querySelector('#tr-hazards');

  let stars = [];
  function generateStars() {
    stars = [];
    const w = canvas.width || 800;
    const h = canvas.height || 600;
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random() * 0.7 + 0.2,
      });
    }
  }

  function resize() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    generateStars();
    draw();
  }

  // === COMPUTE ===
  function computeCurrent() {
    const windowDays = synodicDays(target.aAU);
    const optimalDay = windowDays * 0.35;

    // Phase error — how far from optimal launch date
    const dayError = Math.abs(params.launchDay - optimalDay);
    const phaseError = Math.min(1, dayError / (windowDays * 0.5));

    // Off-optimal penalty on dv
    const phaseDvPenalty = 1 + phaseError * phaseError * 0.6;

    // Transfer mode: 0 = cheap Hohmann, 1 = fast express
    const speedPenalty = 1 + params.transferMode * 0.8;  // up to 1.8x dv for fastest

    // Time: Hohmann at mode=0, faster at higher modes
    const timeMultiplier = 1 - params.transferMode * 0.45;  // fastest = 55% of Hohmann time

    const dvRequired = dvHohmann * phaseDvPenalty * speedPenalty;
    const flightDays = Math.round(flightDaysHohmann * timeMultiplier);
    const margin = (dvAvailable - dvRequired) / dvRequired;

    // Arrival day of year
    const arrivalDaysFromNow = params.launchDay + flightDays;

    return {
      dvRequired: round(dvRequired, 2),
      dvAvailable: round(dvAvailable, 2),
      margin: Math.round(margin * 100),
      flightDays,
      arrivalDaysFromNow,
      phaseError: Math.round(phaseError * 100),
      windowDays: Math.round(windowDays),
      optimalDay: Math.round(optimalDay),
    };
  }

  // === DRAW ===
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const result = computeCurrent();

    // Background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (const s of stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layout
    const sunX = w * 0.5;
    const sunY = h * 0.5;
    const earthOrbit = Math.min(w, h) * 0.18;
    const targetOrbit = earthOrbit * Math.sqrt(target.aAU) * 0.9;

    // Orbit rings
    ctx.strokeStyle = 'rgba(80, 130, 200, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sunX, sunY, earthOrbit, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200, 120, 60, 0.18)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, targetOrbit, 0, Math.PI * 2);
    ctx.stroke();

    // Sun
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
    sunGrad.addColorStop(0, 'rgba(255, 230, 100, 1)');
    sunGrad.addColorStop(0.4, 'rgba(255, 150, 30, 0.5)');
    sunGrad.addColorStop(1, 'rgba(255, 100, 20, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Earth position — depends on launch day
    const earthAngle = (params.launchDay / 365.25) * Math.PI * 2;
    const earthX = sunX + Math.cos(earthAngle) * earthOrbit;
    const earthY = sunY + Math.sin(earthAngle) * earthOrbit;

    // Target position — moved by same amount Earth moved plus phase lead
    // For a Hohmann, the target must be 180° ahead of arrival point
    const targetOrbitalPeriod = 365.25 * Math.pow(target.aAU, 1.5);
    const arrivalDay = params.launchDay + result.flightDays;
    const targetAngle = (arrivalDay / targetOrbitalPeriod) * Math.PI * 2 - Math.PI; // 180° offset
    const targetX = sunX + Math.cos(targetAngle) * targetOrbit;
    const targetY = sunY + Math.sin(targetAngle) * targetOrbit;

    // Draw Earth
    drawBody(earthX, earthY, 9, '#3b82f6', '#1e3a8a', 'EARTH', 0);

    // Draw target
    drawBody(targetX, targetY, 7, planetColor(target), planetDarkColor(target), target.name.toUpperCase(), 0);

    // Trajectory arc — quadratic bezier through midpoint
    const midX = (earthX + targetX) / 2;
    const midY = (earthY + targetY) / 2;
    // Control point pushes the curve outward
    const toSunX = sunX - midX;
    const toSunY = sunY - midY;
    const toSunLen = Math.sqrt(toSunX * toSunX + toSunY * toSunY) || 1;
    const ctrlX = midX + (toSunX / toSunLen) * 40;
    const ctrlY = midY + (toSunY / toSunLen) * 40;

    const willSucceed = result.margin >= 0;
    const pathColor = willSucceed ? '#22d3ee' : '#ef4444';

    // Full path (dim)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Solid path
    ctx.save();
    ctx.shadowColor = pathColor;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
    ctx.stroke();
    ctx.restore();

    // Hazard markers along the arc
    drawHazards(earthX, earthY, ctrlX, ctrlY, targetX, targetY, w, h);

    // Arrowhead at target
    const t = 0.98;
    const ax = bezier(earthX, ctrlX, targetX, t);
    const ay = bezier(earthY, ctrlY, targetY, t);
    ctx.fillStyle = pathColor;
    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fill();

    // Update prediction panel
    renderPrediction(result, target);

    // Enable/disable launch
    launchBtn.disabled = !willSucceed;
  }

  function drawBody(x, y, r, color, dark, label, offset) {
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d8d8e0';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(label, x + r + 8 + offset, y + 4);
  }

  function drawHazards(x0, y0, cx, cy, x1, y1, w, h) {
    // 5 hazard markers along the path
    const hazardPositions = [0.15, 0.32, 0.5, 0.68, 0.85];
    const hazardTypes = ['belt', 'radiation', 'belt', 'flare', 'dust'];
    for (let i = 0; i < hazardPositions.length; i++) {
      const t = hazardPositions[i];
      const px = bezier(x0, cx, x1, t);
      const py = bezier(y0, cy, y1, t);

      const type = hazardTypes[i];
      const color = type === 'belt' ? '#facc15'
                  : type === 'radiation' ? '#a78bfa'
                  : type === 'flare' ? '#ef4444'
                  : '#facc15';

      // Diamond marker
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();

      // Glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function bezier(p0, p1, p2, t) {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  }

  function planetColor(b) {
    const colors = {
      moon: '#c0c0c8', mercury: '#a3a3a3', venus: '#eab308',
      mars: '#f97316', ceres: '#9ca3af', europa: '#93c5fd',
      titan: '#fbbf24', uranus: '#a5f3fc', triton: '#a5f3fc', pluto: '#c4a8a0',
    };
    return colors[b.id] || '#888';
  }

  function planetDarkColor(b) {
    const colors = {
      moon: '#606068', mercury: '#505050', venus: '#7a5a10',
      mars: '#7c2d12', ceres: '#4a4a50', europa: '#3a5580',
      titan: '#7a5a10', uranus: '#3a5a6a', triton: '#3a5a6a', pluto: '#6a4840',
    };
    return colors[b.id] || '#444';
  }

  // === PREDICTION PANEL ===
  function renderPrediction(r, target) {
    const marginColor = r.margin >= 10 ? 'good' : r.margin >= 0 ? 'warn' : 'bad';
    const marginText = r.margin >= 0 ? `+${r.margin}%` : `${r.margin}%`;

    predictionEl.innerHTML = `
      <div class="tr-row">
        <span>Δv required</span>
        <span class="tr-val">${r.dvRequired} km/s</span>
      </div>
      <div class="tr-row">
        <span>Δv available</span>
        <span class="tr-val">${r.dvAvailable} km/s</span>
      </div>
      <div class="tr-row emphasis ${marginColor}">
        <span>Margin</span>
        <span class="tr-val">${marginText}</span>
      </div>
      <div class="tr-row">
        <span>Flight time</span>
        <span class="tr-val">${r.flightDays} days</span>
      </div>
      <div class="tr-row">
        <span>Launch day</span>
        <span class="tr-val">Day ${params.launchDay}</span>
      </div>
      <div class="tr-row">
        <span>Arrival</span>
        <span class="tr-val">Day ${r.arrivalDaysFromNow}</span>
      </div>
      <div class="tr-row">
        <span>Window spacing</span>
        <span class="tr-val">${r.windowDays} days</span>
      </div>
      <div class="tr-row">
        <span>Phase error</span>
        <span class="tr-val">${r.phaseError}%</span>
      </div>
    `;

    // Hazard list
    const hazards = [
      { name: 'Asteroid belt', chance: 15, type: 'belt' },
      { name: 'Solar radiation storm', chance: 25, type: 'radiation' },
      { name: 'Micrometeoroid', chance: 10, type: 'micro' },
      { name: 'Comms blackout', chance: 20, type: 'comms' },
    ];
    hazardsEl.innerHTML = `
      <h2 class="tr-h2" style="margin-top:16px">HAZARDS ON PATH</h2>
      ${hazards.map(h => `
        <div class="tr-hazard-row">
          <span class="tr-hazard-dot" data-type="${h.type}"></span>
          <span class="tr-hazard-name">${h.name}</span>
          <span class="tr-hazard-chance">${h.chance}%</span>
        </div>
      `).join('')}
    `;
  }

  // === EVENT WIRING ===
  daySlider.addEventListener('input', () => {
    params.launchDay = parseInt(daySlider.value, 10);
    root.querySelector('#tr-day-val').textContent = `DAY ${params.launchDay}`;
    draw();
  });

  modeSlider.addEventListener('input', () => {
    params.transferMode = parseInt(modeSlider.value, 10) / 100;
    let label = 'BALANCED';
    if (params.transferMode < 0.25) label = 'CHEAP';
    else if (params.transferMode > 0.75) label = 'FAST';
    root.querySelector('#tr-mode-val').textContent = label;
    draw();
  });

  root.querySelector('#tr-back').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'builder' }));
  });

  launchBtn.addEventListener('click', () => {
    // Save params into state
    state.trajectory = {
      target: target.id,
      launchDay: params.launchDay,
      transferMode: params.transferMode,
      prediction: computeCurrent(),
    };
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'launch' }));
  });

  // Init
  root.querySelector('#tr-day-val').textContent = `DAY ${params.launchDay}`;

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  requestAnimationFrame(() => resize());
}

// === HELPERS ===

async function loadBodies() {
  const res = await fetch('data/core/bodies.json');
  const data = await res.json();
  return data.bodies;
}

function computeDryMass(template, installed) {
  const base = template?.baseStructuralMassKg || 0;
  const partMass = installed.reduce((s, p) => s + (p.mass_kg || 0), 0);
  return base + partMass;
}

function computeAvailableDeltaV(template, installed) {
  const engine = installed.find(p => p.slot === 'engine_cluster');
  const fuelTank = installed.find(p => p.slot === 'fuel_tank');
  const oxTank = installed.find(p => p.slot === 'oxidizer_tank');

  if (!engine || !fuelTank || !oxTank) return 0;

  const dryMass = computeDryMass(template, installed);
  // Propellant mass estimate: 8x the tank structural mass (typical mass fraction)
  const fuelMass = (fuelTank.mass_kg || 0) * 8 + (oxTank.mass_kg || 0) * 8;
  const wetMass = dryMass + fuelMass;

  if (dryMass <= 0 || wetMass <= dryMass) return 0;

  const isp = engine.isp_s || 300;
  const g0 = 9.81;
  const dv = isp * g0 * Math.log(wetMass / dryMass) / 1000;
  return round(dv, 2);
}

function round(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}