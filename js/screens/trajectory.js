import { state } from '../engine/state.js';
import { hohmannDays } from '../engine/derived.js';

// ============================================================
// REAL ORBITAL ELEMENTS (J2000 epoch)
// ============================================================
// Heliocentric ecliptic mean longitudes at J2000 (Jan 1 2000, 12:00 TT), deg
const J2000_LON = {
  mercury: 252.25, venus: 181.98, earth: 100.46, mars: 355.43,
  ceres: 95.99, jupiter: 34.40, saturn: 49.94,
  uranus: 313.23, neptune: 304.88, pluto: 238.93,
};

// Semi-major axes (AU)
const PLANET_AU = {
  mercury: 0.387, venus: 0.723, earth: 1.000, mars: 1.524,
  ceres: 2.77, jupiter: 5.203, saturn: 9.537,
  uranus: 19.19, neptune: 30.07, pluto: 39.48,
};

// Visual scale (fraction of max orbit radius) — hand-tuned so outer planets fit
const ORBIT_FRACTION = {
  mercury: 0.14, venus: 0.26, earth: 0.38, mars: 0.52,
  ceres: 0.66, jupiter: 0.79, saturn: 0.88,
  uranus: 0.94, neptune: 0.985, pluto: 1.00,
};

// Pixel radii on screen
const PLANET_RADIUS = {
  mercury: 6, venus: 10, earth: 12, mars: 8,
  ceres: 4, jupiter: 20, saturn: 17,
  uranus: 13, neptune: 12, pluto: 5,
};

// Search how far ahead for windows
const SEARCH_DAYS = 1825; // 5 years
// Angular tolerance for a launch window (± degrees)
const WINDOW_TOLERANCE_DEG = 4.5;
// Jan 1 2027 is 9861 days after J2000
const J2000_TO_2027 = 9861;

// Planets missing from bodies.json — injected at load
const MISSING_PLANETS = [
  { id: 'earth', name: 'Earth', parent: 'sun', aAU: 1.000 },
  { id: 'jupiter', name: 'Jupiter', parent: 'sun', aAU: 5.203 },
  { id: 'saturn', name: 'Saturn', parent: 'sun', aAU: 9.537 },
  { id: 'neptune', name: 'Neptune', parent: 'sun', aAU: 30.07 },
];

function planetMeanLongitude(planetId, absoluteDay) {
  const startLon = J2000_LON[planetId] || 0;
  const aAU = PLANET_AU[planetId] || 1;
  const period = 365.25 * Math.pow(aAU, 1.5);
  const lon = startLon + (absoluteDay / period) * 360;
  return ((lon % 360) + 360) % 360;
}

function computeLaunchWindows(targetId, startAbsDay, searchDays) {
  const targetAU = PLANET_AU[targetId];
  const targetPeriod = 365.25 * Math.pow(targetAU, 1.5);
  const flightDays = hohmannDays(targetAU);

  // Required phase angle at departure: target must be 180° ahead
  // minus however much it moves during the flight.
  const requiredPhase = ((180 - (flightDays / targetPeriod) * 360) % 360 + 360) % 360;

  const windows = [];
  let inWindow = false;
  let windowStart = 0;

  for (let i = 0; i <= searchDays; i++) {
    const day = startAbsDay + i;
    const earthLon = planetMeanLongitude('earth', day);
    const targetLon = planetMeanLongitude(targetId, day);
    let phase = ((targetLon - earthLon) % 360 + 360) % 360;
    let diff = phase - requiredPhase;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    const inWindowNow = Math.abs(diff) < WINDOW_TOLERANCE_DEG;

    if (inWindowNow && !inWindow) {
      windowStart = i;
      inWindow = true;
    } else if (!inWindowNow && inWindow) {
      windows.push({
        startSol: windowStart,
        endSol: i - 1,
        midSol: Math.round((windowStart + i - 1) / 2),
        lengthDays: i - windowStart,
      });
      inWindow = false;
    }
  }
  if (inWindow) {
    windows.push({
      startSol: windowStart,
      endSol: searchDays,
      midSol: Math.round((windowStart + searchDays) / 2),
      lengthDays: searchDays - windowStart + 1,
    });
  }

  return { windows, requiredPhase, flightDays, targetPeriod };
}

export async function mountTrajectory(root) {
  const mission = state.mission || {};
  const bodies = await loadBodies();

  const targetName = (mission.destination || 'Mars').toLowerCase();
  const target = bodies.find(b => b.id === targetName || b.name.toLowerCase() === targetName)
              || bodies.find(b => b.id === 'mars');

  if (!target) {
    root.innerHTML = '<pre class="screen-error">Target planet not found</pre>';
    return;
  }

  const allBodies = [...bodies];
  for (const m of MISSING_PLANETS) {
    if (!allBodies.find(b => b.id === m.id)) allBodies.push(m);
  }
  const planets = allBodies.filter(b => b.parent === 'sun').sort((a, b) => a.aAU - b.aAU);

  const dvAvailable = computeAvailableDeltaV(state.template, state.installed);

  // Pick a random mission start offset the first time we enter this screen.
  // Stored in state so it stays consistent across re-mounts.
  if (typeof state.missionStartOffset !== 'number') {
    state.missionStartOffset = Math.floor(Math.random() * 500);
  }
  const missionStartAbsDay = J2000_TO_2027 + state.missionStartOffset;

  // Compute launch windows from Sol 0 forward
  const { windows, requiredPhase, flightDays, targetPeriod } =
    computeLaunchWindows(target.id, missionStartAbsDay, SEARCH_DAYS);

  // Default the slider to the first window's midpoint
  const firstWindow = windows[0] || { midSol: 100, startSol: 100, endSol: 120 };
  const params = {
    sol: firstWindow.midSol,
    transferMode: 0.5,
    playing: false,
  };

  const activeWindow = (sol) => windows.find(w => sol >= w.startSol && sol <= w.endSol) || null;
  const nextWindow = (sol) => windows.find(w => w.startSol > sol) || null;

  root.innerHTML = `
    <div class="trajectory-screen">
      <div class="trajectory-canvas-wrap">
        <canvas id="trajectory-canvas"></canvas>

        <div class="trajectory-overlay">
          <div class="trajectory-mission-name">${(mission.name || 'ARES-01').toUpperCase()}</div>
          <div class="trajectory-title">TRAJECTORY PLANNER</div>
          <div class="trajectory-subtitle">TARGET · ${target.name.toUpperCase()} · ${target.aAU.toFixed(3)} AU</div>
        </div>

        <div class="trajectory-time-controls">
          <button class="tr-play" id="tr-play">▶</button>
          <div class="tr-time-label">
            <span class="tr-time-key">MISSION SOL</span>
            <span class="tr-time-value" id="tr-time-value">${params.sol}</span>
          </div>
        </div>

        <div class="trajectory-legend">
          <span><i class="dot-sun"></i> SUN</span>
          <span><i class="dot-earth"></i> EARTH</span>
          <span><i class="dot-target"></i> ${target.name.toUpperCase()}</span>
          <span><i class="dot-path"></i> TRANSFER</span>
          <span><i class="dot-hazard"></i> HAZARD</span>
        </div>
      </div>

      <aside class="trajectory-side">
        <div class="tr-header">
          <div class="tr-header-label">MISSION CONTROL</div>
          <div class="tr-header-value">${(mission.name || 'ARES-01').toUpperCase()}</div>
        </div>

        <div class="tr-section">
          <h2 class="tr-h2">LAUNCH WINDOWS</h2>
          <div class="tr-windows-list" id="tr-windows-list"></div>
          <div class="tr-window-actions">
            <button class="tr-jump-btn" id="tr-jump-next">JUMP TO NEXT WINDOW →</button>
          </div>
        </div>

        <div class="tr-section">
          <h2 class="tr-h2">DEPARTURE SOL</h2>
          <div class="tr-slider-group">
            <div class="tr-slider-label">
              <span>SOL</span>
              <span id="tr-day-val">${params.sol}</span>
            </div>
            <input type="range" id="tr-day-slider" min="0" max="${SEARCH_DAYS}" value="${params.sol}" step="1" />
            <div class="tr-timeline" id="tr-timeline">
              <canvas id="tr-timeline-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="tr-section">
          <h2 class="tr-h2">TRANSFER PROFILE</h2>
          <div class="tr-slider-group">
            <div class="tr-slider-label">
              <span>FUEL ← → SPEED</span>
              <span id="tr-mode-val">BALANCED</span>
            </div>
            <input type="range" id="tr-mode-slider" min="0" max="100" value="50" step="1" />
          </div>
        </div>

        <div class="tr-section">
          <h2 class="tr-h2">MISSION FORECAST</h2>
          <div class="tr-margin-gauge">
            <div class="tr-margin-track">
              <div class="tr-margin-fill" id="tr-margin-fill"></div>
              <div class="tr-margin-center"></div>
            </div>
            <div class="tr-margin-label" id="tr-margin-label">+0%</div>
          </div>
          <div class="tr-prediction" id="tr-prediction"></div>
        </div>

        <div class="tr-actions">
          <button class="btn-secondary" id="tr-back">← BUILDER</button>
          <button class="btn-primary" id="tr-launch" disabled>INITIATE LAUNCH →</button>
        </div>
      </aside>
    </div>
  `;

  const canvas = root.querySelector('#trajectory-canvas');
  const ctx = canvas.getContext('2d');
  const timelineCanvas = root.querySelector('#tr-timeline-canvas');
  const tctx = timelineCanvas.getContext('2d');
  const daySlider = root.querySelector('#tr-day-slider');
  const modeSlider = root.querySelector('#tr-mode-slider');
  const launchBtn = root.querySelector('#tr-launch');
  const predictionEl = root.querySelector('#tr-prediction');
  const marginFill = root.querySelector('#tr-margin-fill');
  const marginLabel = root.querySelector('#tr-margin-label');
  const playBtn = root.querySelector('#tr-play');
  const timeValueEl = root.querySelector('#tr-time-value');
  const windowsListEl = root.querySelector('#tr-windows-list');

  const starLayers = [[], [], []];
  const asteroids = [];
  let bgCache = null;
  let renderTime = 0;
  let lastFrameTime = 0;

  // ---- launch windows info panel ----
  function renderWindowsList() {
    if (windows.length === 0) {
      windowsListEl.innerHTML = '<div class="tr-no-window">No windows within 5 years</div>';
      return;
    }
    const isSol = (w) => params.sol >= w.startSol && params.sol <= w.endSol;
    let html = '';
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      const active = isSol(w);
      html += `
        <button class="tr-window-item ${active ? 'active' : ''}" data-start="${w.startSol}" data-mid="${w.midSol}">
          <span class="tr-window-index">W${i + 1}</span>
          <span class="tr-window-range">SOL ${w.startSol}–${w.endSol}</span>
          <span class="tr-window-days">${w.lengthDays}d</span>
        </button>
      `;
    }
    windowsListEl.innerHTML = html;
    windowsListEl.querySelectorAll('.tr-window-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = parseInt(btn.dataset.mid, 10);
        params.sol = mid;
        daySlider.value = mid;
        root.querySelector('#tr-day-val').textContent = mid;
        timeValueEl.textContent = mid;
        renderWindowsList();
      });
    });
  }

  // ---- timeline strip ----
  function drawTimeline() {
    const w = timelineCanvas.width;
    const h = timelineCanvas.height;
    if (w === 0 || h === 0) return;

    tctx.clearRect(0, 0, w, h);

    // background — off-window days
    tctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    tctx.fillRect(0, 0, w, h);

    // draw windows as green bands
    for (const win of windows) {
      const x1 = (win.startSol / SEARCH_DAYS) * w;
      const x2 = (win.endSol / SEARCH_DAYS) * w;
      tctx.fillStyle = 'rgba(74, 222, 128, 0.55)';
      tctx.fillRect(x1, 0, Math.max(2, x2 - x1), h);
      // bright core at the midpoint
      const xm = (win.midSol / SEARCH_DAYS) * w;
      tctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
      tctx.fillRect(xm - 1, 0, 2, h);
    }

    // current position cursor
    const xc = (params.sol / SEARCH_DAYS) * w;
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(xc - 1, 0, 2, h);

    // glow
    tctx.save();
    tctx.shadowColor = '#22d3ee';
    tctx.shadowBlur = 8;
    tctx.fillStyle = '#22d3ee';
    tctx.fillRect(xc - 0.5, 0, 1, h);
    tctx.restore();
  }

  function resizeTimeline() {
    const wrap = timelineCanvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;
    timelineCanvas.width = rect.width;
    timelineCanvas.height = 18;
    drawTimeline();
  }

  // ---- main canvas ----
  function generateBackground(w, h) {
    const counts = [120, 80, 40];
    const radii = [0.6, 1.1, 1.8];
    const alphas = [0.35, 0.6, 0.95];
    const rates = [0.5, 1.2, 2.0];
    for (let L = 0; L < 3; L++) {
      starLayers[L].length = 0;
      for (let i = 0; i < counts[L]; i++) {
        starLayers[L].push({
          x: Math.random() * w, y: Math.random() * h,
          r: radii[L] * (0.8 + Math.random() * 0.5),
          a: alphas[L] * (0.6 + Math.random() * 0.4),
          phase: Math.random() * Math.PI * 2,
          rate: rates[L] * (0.7 + Math.random() * 0.6),
          warm: Math.random() > 0.85,
        });
      }
    }
    asteroids.length = 0;
    for (let i = 0; i < 500; i++) {
      asteroids.push({
        aAU: 2.1 + Math.random() * 1.3,
        angle: Math.random() * Math.PI * 2,
        size: 0.6 + Math.random() * 1.2,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }
  }

  function generateNebula(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.fillStyle = '#030308';
    cx.fillRect(0, 0, w, h);
    const specs = [
      { x: 0.15, y: 0.25, r: 0.6, color: [90, 40, 150], a: 0.18 },
      { x: 0.85, y: 0.75, r: 0.7, color: [30, 90, 150], a: 0.15 },
      { x: 0.55, y: 0.10, r: 0.55, color: [150, 40, 90], a: 0.11 },
      { x: 0.10, y: 0.90, r: 0.5, color: [40, 110, 130], a: 0.12 },
    ];
    for (const s of specs) {
      const nx = s.x * w, ny = s.y * h;
      const nr = Math.max(w, h) * s.r;
      const grad = cx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      const [r, g, b] = s.color;
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${s.a})`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${s.a * 0.3})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      cx.fillStyle = grad;
      cx.fillRect(0, 0, w, h);
    }
    bgCache = c;
  }

  function resize() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    generateBackground(canvas.width, canvas.height);
    generateNebula(canvas.width, canvas.height);
    resizeTimeline();
  }

  // ---- physics for current sol ----
  function computeCurrent() {
    const absDay = missionStartAbsDay + params.sol;
    const win = activeWindow(params.sol);

    // phase error relative to required phase
    const earthLon = planetMeanLongitude('earth', absDay);
    const targetLon = planetMeanLongitude(target.id, absDay);
    let phase = ((targetLon - earthLon) % 360 + 360) % 360;
    let phaseErr = phase - requiredPhase;
    while (phaseErr > 180) phaseErr -= 360;
    while (phaseErr < -180) phaseErr += 360;

    // delta-V calculation
    const idealDv = hohmannDays(target.aAU) > 0 ? departureDeltaV(target.aAU) : 0;
    const phasePenalty = 1 + Math.pow(Math.abs(phaseErr) / 45, 2);
    const speedPenalty = 1 + params.transferMode * 0.8;
    const dvRequired = idealDv * phasePenalty * speedPenalty;

    const timeMultiplier = 1 - params.transferMode * 0.45;
    const flight = Math.round(flightDays * timeMultiplier);
    const margin = (dvAvailable - dvRequired) / dvRequired;

    // Arrival: where Mars actually is vs where the arc ends
    const arrivalAbsDay = absDay + flight;
    const arrivalTargetLon = planetMeanLongitude(target.id, arrivalAbsDay);
    // Ideal arc ends at Earth's departure direction + 180° (Hohmann half-ellipse)
    const idealArrivalLon = earthLon + 180;
    let arrivalError = ((arrivalTargetLon - idealArrivalLon) % 360 + 360) % 360;
    if (arrivalError > 180) arrivalError -= 360;

    const inWindow = !!win;
    const arrivalValid = Math.abs(arrivalError) < 12; // within 12° of ideal arrival point
    const missionValid = inWindow && arrivalValid && margin >= 0;

    return {
      absDay,
      earthLon, targetLon,
      phase, phaseErr, requiredPhase,
      dvRequired: round(dvRequired, 2),
      dvAvailable: round(dvAvailable, 2),
      margin: Math.round(margin * 100),
      flight,
      arrivalSol: params.sol + flight,
      inWindow,
      arrivalError: Math.round(Math.abs(arrivalError)),
      arrivalValid,
      missionValid,
      window: win,
    };
  }

  // ---- draw ----
  function draw(now) {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    renderTime = now;

    if (params.playing) {
      const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
      params.sol = Math.min(SEARCH_DAYS, params.sol + dt * 8);
      if (params.sol >= SEARCH_DAYS) {
        params.sol = 0;
      }
      daySlider.value = Math.round(params.sol);
      root.querySelector('#tr-day-val').textContent = Math.round(params.sol);
      timeValueEl.textContent = Math.round(params.sol);
      drawTimeline();
      renderWindowsList();
    }
    lastFrameTime = now;

    const result = computeCurrent();

    if (bgCache) ctx.drawImage(bgCache, 0, 0);
    else { ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, w, h); }

    // stars
    for (const layer of starLayers) {
      for (const s of layer) {
        const twinkle = 0.6 + 0.4 * Math.sin(now * 0.001 * s.rate + s.phase);
        const alpha = s.a * twinkle;
        const color = s.warm
          ? `rgba(255, 220, 180, ${alpha})`
          : `rgba(220, 235, 255, ${alpha})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const minDim = Math.min(w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxOrbitR = minDim * 0.42;
    const orbitRadius = (id) => (ORBIT_FRACTION[id] || 0.5) * maxOrbitR;

    // orbit rings
    for (const p of planets) {
      const r = orbitRadius(p.id);
      const isTarget = p.id === target.id;
      const isEarth = p.id === 'earth';
      if (isTarget) {
        ctx.strokeStyle = hexA(planetColor(p), 0.55);
        ctx.lineWidth = 2;
      } else if (isEarth) {
        ctx.strokeStyle = 'rgba(90, 160, 240, 0.5)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = 'rgba(140, 160, 200, 0.15)';
        ctx.lineWidth = 1;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // belt
    const beltR1 = 0.66 * maxOrbitR;
    const beltR2 = 0.79 * maxOrbitR;
    const beltGrad = ctx.createRadialGradient(cx, cy, beltR1, cx, cy, beltR2);
    beltGrad.addColorStop(0, 'rgba(180, 150, 120, 0)');
    beltGrad.addColorStop(0.5, 'rgba(180, 150, 120, 0.07)');
    beltGrad.addColorStop(1, 'rgba(180, 150, 120, 0)');
    ctx.fillStyle = beltGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, beltR2, 0, Math.PI * 2);
    ctx.arc(cx, cy, beltR1, 0, Math.PI * 2, true);
    ctx.fill();

    for (const a of asteroids) {
      const r = (0.66 + (a.aAU - 2.1) / 1.3 * 0.13) * maxOrbitR;
      const x = cx + Math.cos(a.angle) * r;
      const y = cy + Math.sin(a.angle) * r;
      ctx.fillStyle = `rgba(200, 175, 150, ${a.alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, a.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- draw launch window arc — highlight where Earth needs to be ----
    // This shows the departure angle from Earth that would give a clean transfer.
    // It's a marker, not the actual path.
    const earthOrbitR = orbitRadius('earth');
    const idealDepartureLon = (planetMeanLongitude(target.id, missionStartAbsDay + params.sol) - requiredPhase + 360) % 360;
    const idealDepartureRad = idealDepartureLon * Math.PI / 180 - Math.PI / 2;
    ctx.save();
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, earthOrbitR, idealDepartureRad - 0.12, idealDepartureRad + 0.12);
    ctx.stroke();
    ctx.restore();

    // sun
    drawSun(cx, cy, now);

    // current planet positions
    const positions = {};
    for (const p of planets) {
      const lon = planetMeanLongitude(p.id, result.absDay);
      const rad = lon * Math.PI / 180 - Math.PI / 2;
      const r = orbitRadius(p.id);
      positions[p.id] = {
        x: cx + Math.cos(rad) * r,
        y: cy + Math.sin(rad) * r,
        lon, rad, r,
      };
    }

    // background planets
    for (const p of planets) {
      if (p.id === 'earth' || p.id === target.id) continue;
      const pos = positions[p.id];
      if (!pos) continue;
      drawPlanetSmall(pos.x, pos.y, p, now);
    }

    // ---- transfer arc ----
    const earthPos = positions['earth'];
    const r1 = earthOrbitR;
    const r2 = orbitRadius(target.id);
    const color = result.missionValid ? '#22d3ee' : '#ef4444';
    const animatedT = Math.min(1, (now % 6000) / 4200);
    const departureRad = earthPos.rad;

    drawHohmannArc(cx, cy, departureRad, r1, r2, color, animatedT, result);

    // ---- draw target at ACTUAL arrival position (not current) ----
    const arrivalAbsDay = result.absDay + result.flight;
    const arrivalLon = planetMeanLongitude(target.id, arrivalAbsDay);
    const arrivalRad = arrivalLon * Math.PI / 180 - Math.PI / 2;
    const arrivalX = cx + Math.cos(arrivalRad) * r2;
    const arrivalY = cy + Math.sin(arrivalRad) * r2;

    // Ghost "ideal arrival" ring where the arc actually ends
    const idealArrivalLon = (earthPos.lon + 180) % 360;
    const idealArrivalRad = idealArrivalLon * Math.PI / 180 - Math.PI / 2;
    const idealArrivalX = cx + Math.cos(idealArrivalRad) * r2;
    const idealArrivalY = cy + Math.sin(idealArrivalRad) * r2;

    // Ideal arrival marker
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(idealArrivalX, idealArrivalY, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('ARC END', idealArrivalX + 18, idealArrivalY + 3);

    // Draw target where it will actually be at arrival
    drawPlanetSmall(arrivalX, arrivalY, target, now);
    ctx.fillStyle = result.arrivalValid ? '#4ade80' : '#ef4444';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(`${target.name.toUpperCase()} @ ARRIVAL`, arrivalX + 18, arrivalY - 8);
    ctx.fillStyle = 'rgba(200, 220, 255, 0.75)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`ERROR ${result.arrivalError}°`, arrivalX + 18, arrivalY + 8);

    // Earth and target current positions (large)
    drawEarthLarge(earthPos.x, earthPos.y, now);
    const currTargetPos = positions[target.id];
    if (currTargetPos) {
      drawPlanetSmall(currTargetPos.x, currTargetPos.y, target, now);
      ctx.fillStyle = 'rgba(200, 220, 255, 0.5)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${target.name.toUpperCase()} NOW`, currTargetPos.x + 14, currTargetPos.y + 3);
    }

    // vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, minDim * 0.4, w / 2, h / 2, Math.max(w, h) * 0.85);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    renderPrediction(result, target);
    updateMarginGauge(result);
  }

  // ---- Hohmann half-ellipse arc ----
  function drawHohmannArc(sx, sy, departureRad, r1, r2, color, animatedT, result) {
    const a = (r1 + r2) / 2;
    const e = (r2 - r1) / (r2 + r1);
    const N = 100;
    const points = [];
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * Math.PI;
      const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
      const xLocal = r * Math.cos(theta);
      const yLocal = r * Math.sin(theta);
      const xRot = xLocal * Math.cos(departureRad) - yLocal * Math.sin(departureRad);
      const yRot = xLocal * Math.sin(departureRad) + yLocal * Math.cos(departureRad);
      points.push({ x: sx + xRot, y: sy + yRot });
    }

    // faint full
    ctx.strokeStyle = hexA(color, 0.15);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // bright animated
    const endIdx = Math.max(1, Math.floor(animatedT * N));
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= endIdx; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    // day markers
    for (const t of [0.25, 0.5, 0.75]) {
      const idx = Math.floor(t * N);
      const p = points[idx];
      const day = Math.round(result.flight * t);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA(color, 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200, 235, 255, 0.9)';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(`D+${day}`, p.x + 10, p.y - 8);
    }

    // spacecraft
    const spIdx = Math.min(N, Math.floor(animatedT * N));
    const sp = points[spIdx];
    if (sp) {
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 20);
      g.addColorStop(0, hexA(color, 0.9));
      g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // flight time
    const mid = points[Math.floor(N / 2)];
    if (mid) {
      ctx.fillStyle = 'rgba(220, 240, 255, 0.95)';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${result.flight} DAYS`, mid.x, mid.y - 22);
      ctx.textAlign = 'start';
    }
  }

  function drawSun(sx, sy, now) {
    const pulse = 1 + 0.06 * Math.sin(now * 0.002);
    const coreR = 22;
    const coronaR = 60 * pulse;
    const corona = ctx.createRadialGradient(sx, sy, 0, sx, sy, coronaR);
    corona.addColorStop(0, 'rgba(255, 245, 210, 1)');
    corona.addColorStop(0.15, 'rgba(255, 210, 120, 0.8)');
    corona.addColorStop(0.45, 'rgba(255, 150, 50, 0.35)');
    corona.addColorStop(1, 'rgba(255, 100, 30, 0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sx, sy, coronaR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe680';
    ctx.beginPath();
    ctx.arc(sx, sy, coreR * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4c4';
    ctx.beginPath();
    ctx.arc(sx, sy, coreR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlanetSmall(x, y, body, now) {
    const r = PLANET_RADIUS[body.id] || 6;
    const c = planetColor(body);
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.8);
    g.addColorStop(0, hexA(c, 0.35));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    drawSurface(x, y, r, body, now);
  }

  function drawEarthLarge(x, y, now) {
    const r = PLANET_RADIUS.earth * 1.3;
    const atmo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.2);
    atmo.addColorStop(0, 'rgba(120, 200, 255, 0.55)');
    atmo.addColorStop(1, 'rgba(120, 200, 255, 0)');
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    drawSurface(x, y, r, { id: 'earth' }, now);
    ctx.fillStyle = '#b0d0ff';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('EARTH', x + r + 10, y + 4);
  }

  function drawSurface(x, y, r, body, now) {
    const c = planetColor(body);
    const dark = planetDarkColor(body);
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    grad.addColorStop(0, lighten(c, 0.3));
    grad.addColorStop(0.65, c);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    const id = body.id;
    if (id === 'jupiter' || id === 'saturn') {
      for (let i = 0; i < 5; i++) {
        const yb = y - r + (i + 0.5) * (r * 2 / 5);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(120, 80, 40, 0.35)' : 'rgba(240, 220, 180, 0.3)';
        ctx.fillRect(x - r, yb - r * 0.15, r * 2, r * 0.3);
      }
      if (id === 'jupiter') {
        ctx.fillStyle = 'rgba(180, 80, 60, 0.75)';
        ctx.beginPath();
        ctx.ellipse(x + r * 0.2, y + r * 0.15, r * 0.3, r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'earth') {
      const rot = now * 0.00004;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(70, 130, 70, 0.85)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.15, -r * 0.25, r * 0.5, r * 0.4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.3, r * 0.15, r * 0.4, r * 0.35, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240, 250, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(0, -r * 0.8, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (id === 'mars') {
      ctx.fillStyle = 'rgba(120, 60, 30, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.15, y + r * 0.1, r * 0.35, r * 0.25, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240, 240, 250, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.8, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + r * 0.8, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'venus') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + now * 0.00005;
        ctx.strokeStyle = 'rgba(255, 230, 180, 0.4)';
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.65, a, a + 1.1);
        ctx.stroke();
      }
    } else if (id === 'mercury' || id === 'moon' || id === 'ceres' || id === 'pluto') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + now * 0.00002;
        const cr = r * (0.1 + (i % 3) * 0.06);
        const cxp = x + Math.cos(a) * r * 0.4;
        const cyp = y + Math.sin(a) * r * 0.4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(cxp, cyp, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'uranus' || id === 'neptune') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 2; i++) {
        const yb = y - r * 0.3 + i * r * 0.6;
        ctx.fillRect(x - r, yb - r * 0.06, r * 2, r * 0.12);
      }
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function lighten(hex, amount) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function planetColor(b) {
    const colors = {
      moon: '#c0c0c8', mercury: '#a8a29a', venus: '#e8c87a',
      earth: '#3b82f6', mars: '#c1440e', ceres: '#9a9088',
      jupiter: '#d8a878', saturn: '#e8d090',
      uranus: '#a8e0e8', neptune: '#4a72d0', pluto: '#c4a89a',
    };
    return colors[b.id] || '#888888';
  }

  function planetDarkColor(b) {
    const colors = {
      moon: '#5a5a62', mercury: '#5a5450', venus: '#8a6830',
      earth: '#0a2850', mars: '#5a1a08', ceres: '#4a4038',
      jupiter: '#7a5838', saturn: '#8a7040',
      uranus: '#4a7880', neptune: '#1a2a70', pluto: '#6a5048',
    };
    return colors[b.id] || '#444444';
  }

  function hexA(hex, alpha) {
    if (hex.startsWith('rgb')) {
      const m = hex.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
      return hex;
    }
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function updateMarginGauge(result) {
    const m = result.margin;
    const pct = Math.max(-100, Math.min(200, m));
    const normalized = (pct + 100) / 3;
    marginFill.style.width = Math.min(100, normalized) + '%';

    if (!result.inWindow) {
      marginFill.style.background = 'rgba(120, 120, 130, 0.4)';
    } else if (m >= 20) {
      marginFill.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
    } else if (m >= 0) {
      marginFill.style.background = 'linear-gradient(90deg, #eab308, #facc15)';
    } else {
      marginFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    }

    if (!result.inWindow) {
      marginLabel.textContent = 'NO WINDOW';
      marginLabel.className = 'tr-margin-label bad';
      launchBtn.disabled = true;
      return;
    }

    const sign = m >= 0 ? '+' : '';
    marginLabel.textContent = `${sign}${m}%`;
    marginLabel.className = 'tr-margin-label ' + (m >= 20 ? 'good' : m >= 0 ? 'warn' : 'bad');
    launchBtn.disabled = !result.missionValid;
  }

  function renderPrediction(r, target) {
    const windowStatus = r.inWindow
      ? `<span class="tr-good">IN WINDOW (W${windows.indexOf(r.window) + 1})</span>`
      : (() => {
          const nw = nextWindow(params.sol);
          return nw
            ? `<span class="tr-bad">OUT OF WINDOW — next at SOL ${nw.startSol}</span>`
            : '<span class="tr-bad">OUT OF WINDOW — none ahead</span>';
        })();

    const arrivalStatus = r.arrivalValid
      ? `<span class="tr-good">HIT</span>`
      : `<span class="tr-bad">MISS by ${r.arrivalError}°</span>`;

    predictionEl.innerHTML = `
      <div class="tr-row"><span>Window status</span><span class="tr-val">${windowStatus}</span></div>
      <div class="tr-row"><span>Phase error</span><span class="tr-val">${Math.round(Math.abs(r.phaseErr) * 10) / 10}°</span></div>
      <div class="tr-row"><span>Required phase</span><span class="tr-val">${Math.round(r.requiredPhase)}°</span></div>
      <div class="tr-row"><span>Actual phase</span><span class="tr-val">${Math.round(r.phase)}°</span></div>
      <div class="tr-row"><span>Δv required</span><span class="tr-val">${r.dvRequired} km/s</span></div>
      <div class="tr-row"><span>Δv available</span><span class="tr-val">${r.dvAvailable} km/s</span></div>
      <div class="tr-row"><span>Flight time</span><span class="tr-val">${r.flight} days</span></div>
      <div class="tr-row"><span>Arrival</span><span class="tr-val">SOL ${r.arrivalSol}</span></div>
      <div class="tr-row"><span>Arrival match</span><span class="tr-val">${arrivalStatus}</span></div>
    `;
  }

  let running = true;
  let lastErr = 0;
  function loop(now) {
    if (!running) return;
    if (!document.body.contains(canvas)) { running = false; return; }
    try { draw(now); }
    catch (err) {
      if (now - lastErr > 2000) {
        console.error('[trajectory] draw error:', err);
        lastErr = now;
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  daySlider.addEventListener('input', () => {
    params.sol = parseInt(daySlider.value, 10);
    root.querySelector('#tr-day-val').textContent = params.sol;
    timeValueEl.textContent = params.sol;
    drawTimeline();
    renderWindowsList();
  });

  modeSlider.addEventListener('input', () => {
    params.transferMode = parseInt(modeSlider.value, 10) / 100;
    let label = 'BALANCED';
    if (params.transferMode < 0.25) label = 'ECONOMY';
    else if (params.transferMode > 0.75) label = 'EXPRESS';
    root.querySelector('#tr-mode-val').textContent = label;
  });

  playBtn.addEventListener('click', () => {
    params.playing = !params.playing;
    playBtn.textContent = params.playing ? '⏸' : '▶';
    playBtn.classList.toggle('playing', params.playing);
  });

  root.querySelector('#tr-jump-next').addEventListener('click', () => {
    const nw = nextWindow(params.sol) || windows[0];
    if (nw) {
      params.sol = nw.midSol;
      daySlider.value = nw.midSol;
      root.querySelector('#tr-day-val').textContent = nw.midSol;
      timeValueEl.textContent = nw.midSol;
      drawTimeline();
      renderWindowsList();
    }
  });

  root.querySelector('#tr-back').addEventListener('click', () => {
    running = false;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'builder' }));
  });

  launchBtn.addEventListener('click', () => {
    if (launchBtn.disabled) return;
    const result = computeCurrent();
    if (!result.missionValid) return;
    state.trajectory = {
      target: target.id,
      launchSol: Math.round(params.sol),
      transferMode: params.transferMode,
      flightDays: result.flight,
      arrivalSol: result.arrivalSol,
      prediction: result,
    };
    running = false;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'launch' }));
  });

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  requestAnimationFrame(() => {
    resize();
    renderWindowsList();
  });
}

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
  const fuelMass = (fuelTank.mass_kg || 0) * 8 + (oxTank.mass_kg || 0) * 8;
  const wetMass = dryMass + fuelMass;
  if (dryMass <= 0 || wetMass <= dryMass) return 0;
  const isp = engine.isp_s || 300;
  const dv = isp * 9.81 * Math.log(wetMass / dryMass) / 1000;
  return Math.round(dv * 100) / 100;
}

function departureDeltaV(aAU) {
  const MU_SUN = 1.32712440018e11;
  const MU_EARTH = 398600.4418;
  const AU = 1.495978707e8;
  const R_LEO = 6378.137 + 200;
  const r1 = AU;
  const r2 = aAU * AU;
  const vEarth = Math.sqrt(MU_SUN / r1);
  const vInf = Math.abs(vEarth * (Math.sqrt(2 * r2 / (r1 + r2)) - 1));
  const vCirc = Math.sqrt(MU_EARTH / R_LEO);
  return Math.sqrt(vInf * vInf + 2 * vCirc * vCirc) - vCirc;
}

function round(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}