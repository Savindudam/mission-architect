import { state, adjustMeter, logEvent, notify } from '../engine/state.js';

let eventsData = null;

async function loadEvents() {
  if (eventsData) return eventsData;
  const res = await fetch('data/flight_events.json');
  if (!res.ok) throw new Error('Failed to load flight_events.json');
  const json = await res.json();
  eventsData = json.events;
  return eventsData;
}

export async function mountFlight(root) {
  const events = await loadEvents();

  const mission = state.mission || {};
  const solsPlayable = 90;
  const hasBelt = /mars|jupiter|saturn|uranus|neptune|pluto|ceres/i.test(mission.target || '');

  const resources = {
    fuel: Math.round(state.flight?.startFuel ?? 92),
    power: 100,
    hull: 100,
    data: 0,
  };

  const sim = {
    sol: 0,
    totalSols: solsPlayable,
    speed: 2,
    paused: false,
    ended: false,
    nextEventSol: 8,
    usedEvents: new Set(),
    eventOpen: false,
  };

  root.innerHTML = `
    <div class="flight-screen">
      <div class="flight-topbar">
        <div class="flight-header">
          <div class="flight-kicker">CRUISE PHASE · ${(mission.name || 'MISSION').toUpperCase()}</div>
          <div class="flight-title">OUTBOUND TRANSIT</div>
        </div>
        <div class="flight-sol">
          <span class="flight-sol-key">SOL</span>
          <span class="flight-sol-value"><span id="flight-sol">0</span> / ${solsPlayable}</span>
        </div>
      </div>

      <div class="flight-progress-bar">
        <div class="flight-progress-fill" id="flight-progress"></div>
        <div class="flight-progress-labels">
          <span>EARTH</span>
          <span>${(mission.target || 'TARGET').toUpperCase()}</span>
        </div>
      </div>

      <div class="flight-resources" id="flight-resources"></div>

      <div class="flight-canvas-wrap">
        <canvas id="flight-canvas"></canvas>
        <div class="flight-controls">
          <button class="time-btn active" data-speed="1">1x</button>
          <button class="time-btn" data-speed="2">2x</button>
          <button class="time-btn" data-speed="4">4x</button>
          <button class="time-btn" data-speed="8">8x</button>
          <button class="time-btn pause-btn" id="btn-pause">PAUSE</button>
        </div>
      </div>

      <div class="flight-log" id="flight-log">
        <div class="log-entry log-dim">Cruise phase underway. Systems nominal.</div>
      </div>
    </div>

    <div class="event-modal" id="flight-event-modal" style="display:none;"></div>
  `;

  const canvas = root.querySelector('#flight-canvas');
  const ctx = canvas.getContext('2d');
  const resourcesEl = root.querySelector('#flight-resources');
  const logEl = root.querySelector('#flight-log');
  const progressEl = root.querySelector('#flight-progress');
  const solEl = root.querySelector('#flight-sol');
  const pauseBtn = root.querySelector('#btn-pause');
  const modalEl = root.querySelector('#flight-event-modal');

  // ---- background caches ----
  const starLayers = [[], [], []];
  const asteroidBelt = [];
  const nebulaCanvas = document.createElement('canvas');
  let eventFlash = 0;

  function generateBackground(w, h) {
    // three parallax star layers
    const layerSpecs = [
      { count: 80, minR: 0.4, maxR: 0.8, minA: 0.25, maxA: 0.5 },
      { count: 55, minR: 0.7, maxR: 1.2, minA: 0.5, maxA: 0.8 },
      { count: 30, minR: 1.0, maxR: 1.7, minA: 0.75, maxA: 1.0 },
    ];

    for (let L = 0; L < 3; L++) {
      starLayers[L].length = 0;
      const spec = layerSpecs[L];
      for (let i = 0; i < spec.count; i++) {
        starLayers[L].push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: spec.minR + Math.random() * (spec.maxR - spec.minR),
          a: spec.minA + Math.random() * (spec.maxA - spec.minA),
          phase: Math.random() * Math.PI * 2,
          rate: 0.6 + Math.random() * 1.4,
          warm: Math.random() > 0.88,
        });
      }
    }

    // asteroid belt
    asteroidBelt.length = 0;
    if (hasBelt) {
      for (let i = 0; i < 70; i++) {
        asteroidBelt.push({
          t: 0.28 + Math.random() * 0.18,
          offset: (Math.random() - 0.5) * 90,
          size: 0.6 + Math.random() * 1.6,
          alpha: 0.35 + Math.random() * 0.5,
        });
      }
    }

    // nebula background rendered once
    nebulaCanvas.width = w;
    nebulaCanvas.height = h;
    const nctx = nebulaCanvas.getContext('2d');
    nctx.fillStyle = '#04040a';
    nctx.fillRect(0, 0, w, h);

    const nebulaSpecs = [
      { x: 0.15, y: 0.30, r: 0.5, color: [70, 40, 120], a: 0.22 },
      { x: 0.80, y: 0.70, r: 0.55, color: [30, 70, 130], a: 0.20 },
      { x: 0.50, y: 0.15, r: 0.4, color: [120, 40, 80], a: 0.14 },
      { x: 0.55, y: 0.85, r: 0.4, color: [40, 90, 120], a: 0.13 },
    ];
    for (const s of nebulaSpecs) {
      const nx = s.x * w, ny = s.y * h;
      const nr = Math.max(w, h) * s.r;
      const grad = nctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      const [r, g, b] = s.color;
      grad.addColorStop(0, `rgba(${r},${g},${b},${s.a})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${s.a * 0.3})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      nctx.fillStyle = grad;
      nctx.fillRect(0, 0, w, h);
    }
  }

  function resize() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    generateBackground(canvas.width, canvas.height);
    draw();
  }

  // ---- geometry helpers ----

  function bezier(p0, p1, p2, t) {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  }

  function bezierTangent(p0, p1, p2, t) {
    return 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1);
  }

  function getCurve() {
    const w = canvas.width;
    const h = canvas.height;
    const earthX = w * 0.10;
    const earthY = h * 0.68;
    const targetX = w * 0.90;
    const targetY = h * 0.30;
    const cx = w * 0.50;
    const cy = h * 0.08;
    return { earthX, earthY, targetX, targetY, cx, cy };
  }

  // ---- planet drawing ----

  const PLANET_COLORS = {
    moon:    { light: '#e8e8f0', mid: '#a8a8b0', dark: '#505058' },
    earth:   { light: '#5ab8ff', mid: '#1e5a9a', dark: '#062043' },
    mars:    { light: '#f09060', mid: '#c1440e', dark: '#5a1a08' },
    venus:   { light: '#f8e8b0', mid: '#e8c87a', dark: '#8a6830' },
    mercury: { light: '#c8c0b0', mid: '#a8a29a', dark: '#5a5450' },
    ceres:   { light: '#b8b0a8', mid: '#9a9088', dark: '#4a4038' },
    jupiter: { light: '#f0d8b8', mid: '#d8a878', dark: '#7a5838' },
    saturn:  { light: '#f8e8c0', mid: '#e8d090', dark: '#8a7040' },
    europa:  { light: '#e8f4ff', mid: '#c0d8f0', dark: '#6a88a8' },
    titan:   { light: '#f0c878', mid: '#d8a040', dark: '#7a5a10' },
    uranus:  { light: '#d8f4f8', mid: '#a8e0e8', dark: '#4a7880' },
    neptune: { light: '#8a9ae8', mid: '#4a72d0', dark: '#1a2a70' },
    pluto:   { light: '#d8c8b8', mid: '#c4a89a', dark: '#6a5048' },
  };

  function drawPlanet(x, y, r, id, time, glowStrength = 1) {
    const c = PLANET_COLORS[id] || PLANET_COLORS.mars;

    // outer glow halo
    if (glowStrength > 0.05) {
      const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.2);
      halo.addColorStop(0, hexA(c.light, 0.35 * glowStrength));
      halo.addColorStop(0.5, hexA(c.mid, 0.12 * glowStrength));
      halo.addColorStop(1, hexA(c.mid, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // body gradient
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    grad.addColorStop(0, c.light);
    grad.addColorStop(0.65, c.mid);
    grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // surface details inside a clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    if (id === 'jupiter' || id === 'saturn') {
      const bands = 5;
      for (let i = 0; i < bands; i++) {
        const yb = y - r + (i + 0.5) * (r * 2 / bands);
        ctx.fillStyle = i % 2 === 0
          ? 'rgba(120,80,40,0.35)'
          : 'rgba(240,220,180,0.3)';
        ctx.fillRect(x - r, yb - r * 0.16, r * 2, r * 0.32);
      }
      if (id === 'jupiter') {
        ctx.fillStyle = 'rgba(180,80,60,0.7)';
        ctx.beginPath();
        ctx.ellipse(x + r * 0.2, y + r * 0.15, r * 0.3, r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'mars') {
      // dark plains
      ctx.fillStyle = 'rgba(120,60,30,0.55)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.15, y + r * 0.1, r * 0.4, r * 0.28, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.3, y - r * 0.2, r * 0.25, r * 0.18, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // polar caps
      ctx.fillStyle = 'rgba(240,240,250,0.85)';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.85, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + r * 0.85, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'earth') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.00004);
      // continents
      ctx.fillStyle = 'rgba(70,130,70,0.9)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.15, -r * 0.25, r * 0.5, r * 0.4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.3, r * 0.15, r * 0.42, r * 0.36, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, r * 0.4, r * 0.28, r * 0.22, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.4, -r * 0.4, r * 0.22, r * 0.18, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // ice caps
      ctx.fillStyle = 'rgba(240,250,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, -r * 0.85, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, r * 0.85, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (id === 'venus') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + time * 0.00008;
        ctx.strokeStyle = 'rgba(255,230,180,0.4)';
        ctx.lineWidth = r * 0.14;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, a, a + 1.1);
        ctx.stroke();
      }
    } else if (id === 'moon' || id === 'mercury' || id === 'ceres' || id === 'pluto') {
      const craterCount = 8;
      for (let i = 0; i < craterCount; i++) {
        const a = (i / craterCount) * Math.PI * 2 + time * 0.00004;
        const cx = x + Math.cos(a) * r * (0.2 + (i % 3) * 0.15);
        const cy = y + Math.sin(a) * r * (0.2 + (i % 2) * 0.2);
        const cr = r * (0.07 + (i % 4) * 0.035);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(cx - cr * 0.3, cy - cr * 0.3, cr * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'uranus' || id === 'neptune') {
      for (let i = 0; i < 2; i++) {
        const yb = y - r * 0.3 + i * r * 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x - r, yb - r * 0.06, r * 2, r * 0.12);
      }
    }

    ctx.restore();

    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // saturn rings
    if (id === 'saturn') {
      ctx.save();
      ctx.strokeStyle = 'rgba(230, 210, 170, 0.55)';
      ctx.lineWidth = r * 0.32;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.9, r * 0.5, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(250, 230, 190, 0.35)';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.1, r * 0.55, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // ---- main render ----

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const time = performance.now();

    // background nebula
    ctx.drawImage(nebulaCanvas, 0, 0);

    // star layers with twinkle
    for (const layer of starLayers) {
      for (const s of layer) {
        const tw = 0.65 + 0.35 * Math.sin(time * 0.001 * s.rate + s.phase);
        const a = s.a * tw;
        ctx.fillStyle = s.warm
          ? `rgba(255, 220, 180, ${a})`
          : `rgba(220, 235, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // distant sun in the upper-left corner
    const sunX = w * 0.06;
    const sunY = h * 0.14;
    const sunR = 10;
    const corona = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 8);
    corona.addColorStop(0, 'rgba(255, 245, 200, 1)');
    corona.addColorStop(0.15, 'rgba(255, 200, 100, 0.7)');
    corona.addColorStop(0.4, 'rgba(255, 140, 50, 0.25)');
    corona.addColorStop(1, 'rgba(255, 100, 20, 0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.5, 0, Math.PI * 2);
    ctx.fill();

    const { earthX, earthY, targetX, targetY, cx, cy } = getCurve();
    const t = Math.min(1, sim.sol / sim.totalSols);

    // orbit arcs at the endpoints
    ctx.strokeStyle = 'rgba(90, 130, 200, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(earthX, earthY, 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200, 120, 80, 0.18)';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 26, 0, Math.PI * 2);
    ctx.stroke();

    // asteroid belt
    if (asteroidBelt.length > 0) {
      for (const ast of asteroidBelt) {
        const ax = bezier(earthX, cx, targetX, ast.t) + ast.offset;
        const ay = bezier(earthY, cy, targetY, ast.t) + ast.offset * 0.5;
        const tw = 0.7 + 0.3 * Math.sin(time * 0.001 + ast.t * 20);
        ctx.fillStyle = `rgba(180, 160, 140, ${ast.alpha * tw})`;
        ctx.beginPath();
        ctx.arc(ax, ay, ast.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // full trajectory (dashed, dim)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    ctx.quadraticCurveTo(cx, cy, targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // travelled path (solid, glowing)
    if (t > 0) {
      ctx.save();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const segs = 80;
      const maxI = Math.max(1, Math.floor(segs * t));
      for (let i = 0; i <= maxI; i++) {
        const tt = i / segs;
        const px = bezier(earthX, cx, targetX, tt);
        const py = bezier(earthY, cy, targetY, tt);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // day markers along the trajectory
    for (const mt of [0.25, 0.5, 0.75]) {
      const px = bezier(earthX, cx, targetX, mt);
      const py = bezier(earthY, cy, targetY, mt);
      const day = Math.round(sim.totalSols * mt);
      const passed = mt <= t;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = passed ? 'rgba(34, 211, 238, 0.9)' : 'rgba(120, 140, 160, 0.4)';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();

      ctx.fillStyle = passed ? 'rgba(180, 220, 255, 0.85)' : 'rgba(120, 140, 160, 0.5)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`D+${day}`, px + 10, py - 6);
    }

    // Earth and target
    const earthGlow = Math.max(0.3, 1 - t * 1.2);
    const targetGlow = Math.min(1, 0.3 + t * 1.2);
    drawPlanet(earthX, earthY, 16, 'earth', time, earthGlow);
    drawPlanet(targetX, targetY, 13, targetIdFor(mission), time, targetGlow);

    // labels
    ctx.fillStyle = '#b0d0ff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('EARTH', earthX + 20, earthY + 4);

    ctx.fillStyle = '#d8d8e0';
    ctx.fillText((mission.target || 'TARGET').toUpperCase(), targetX + 20, targetY + 4);

    // comms wave from Earth occasionally
    if (t < 0.9) {
      const wavePhase = (time * 0.0008) % 1;
      const waveT = t * 0.6 + wavePhase * 0.3;
      if (waveT < t) {
        const wx = bezier(earthX, cx, targetX, waveT);
        const wy = bezier(earthY, cy, targetY, waveT);
        for (let i = 0; i < 3; i++) {
          const r = (i + 1) * 6 + (time * 0.02 % 6);
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.35 - i * 0.1})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wx, wy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // ship position and direction
    const shipX = bezier(earthX, cx, targetX, t);
    const shipY = bezier(earthY, cy, targetY, t);
    const tangX = bezierTangent(earthX, cx, targetX, t);
    const tangY = bezierTangent(earthY, cy, targetY, t);
    const angle = Math.atan2(tangY, tangX);

    // comet trail behind ship
    for (let i = 1; i <= 18; i++) {
      const tt = t - i * 0.008;
      if (tt < 0) break;
      const tx = bezier(earthX, cx, targetX, tt);
      const ty = bezier(earthY, cy, targetY, tt);
      const fade = 1 - i / 18;
      ctx.fillStyle = `rgba(34, 211, 238, ${fade * 0.6})`;
      ctx.beginPath();
      ctx.arc(tx, ty, 1 + fade * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ship glow
    const shipGlow = ctx.createRadialGradient(shipX, shipY, 0, shipX, shipY, 26);
    shipGlow.addColorStop(0, 'rgba(34, 211, 238, 0.7)');
    shipGlow.addColorStop(0.4, 'rgba(34, 211, 238, 0.2)');
    shipGlow.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = shipGlow;
    ctx.beginPath();
    ctx.arc(shipX, shipY, 26, 0, Math.PI * 2);
    ctx.fill();

    // ship body
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(angle);

    // engine flame behind
    const flameLen = 8 + Math.random() * 5;
    const flameGrad = ctx.createLinearGradient(-7, 0, -7 - flameLen, 0);
    flameGrad.addColorStop(0, 'rgba(255, 220, 100, 0.9)');
    flameGrad.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(-7 - flameLen, 0);
    ctx.lineTo(-7, 3);
    ctx.closePath();
    ctx.fill();

    // hull
    ctx.fillStyle = '#e8f0f8';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-7, -5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.fill();

    // dark line down the side
    ctx.strokeStyle = '#4a5a6a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-4, 0);
    ctx.stroke();

    // cockpit dot
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(2, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // event flash overlay
    if (eventFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${eventFlash})`;
      ctx.fillRect(0, 0, w, h);
      eventFlash *= 0.9;
      if (eventFlash < 0.01) eventFlash = 0;
    }

    // speed lines during high warp
    if (sim.speed >= 4 && !sim.paused && !sim.ended) {
      const lineCount = sim.speed >= 8 ? 12 : 6;
      for (let i = 0; i < lineCount; i++) {
        const ly = (Math.random() * h * 0.9) + h * 0.05;
        const lx = Math.random() * w;
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 40 + Math.random() * 60, ly);
        ctx.stroke();
      }
    }
  }

  function targetIdFor(m) {
    const t = (m.target || '').toLowerCase();
    if (t.includes('moon')) return 'moon';
    if (t.includes('mars')) return 'mars';
    if (t.includes('venus')) return 'venus';
    if (t.includes('mercury')) return 'mercury';
    if (t.includes('ceres')) return 'ceres';
    if (t.includes('jupiter')) return 'jupiter';
    if (t.includes('saturn')) return 'saturn';
    if (t.includes('europa')) return 'europa';
    if (t.includes('titan')) return 'titan';
    if (t.includes('uranus')) return 'uranus';
    if (t.includes('neptune')) return 'neptune';
    if (t.includes('pluto')) return 'pluto';
    return 'mars';
  }

  // ---- resource bars ----

  function renderResources() {
    const specs = [
      { key: 'fuel',  label: 'FUEL',  color: '#facc15' },
      { key: 'power', label: 'POWER', color: '#22d3ee' },
      { key: 'hull',  label: 'HULL',  color: '#a78bfa' },
      { key: 'data',  label: 'DATA',  color: '#4ade80' },
    ];
    resourcesEl.innerHTML = specs.map(s => {
      const v = resources[s.key];
      const pct = Math.max(0, Math.min(100, v));
      const cls = v <= 20 ? 'critical' : v <= 40 ? 'warn' : '';
      return '<div class="flight-resource ' + cls + '">' +
        '<div class="flight-resource-label"><span>' + s.label + '</span><span class="flight-resource-val">' + Math.round(v) + '</span></div>' +
        '<div class="flight-resource-bar"><div class="flight-resource-fill" style="width:' + pct + '%; background:' + s.color + '"></div></div>' +
        '</div>';
    }).join('');
  }

  function addLog(text, type) {
    const dim = logEl.querySelector('.log-dim');
    if (dim) dim.remove();
    const el = document.createElement('div');
    el.className = 'log-entry' + (type ? ' log-' + type : '');
    el.textContent = 'SOL ' + sim.sol + ' — ' + text;
    logEl.prepend(el);
    while (logEl.children.length > 12) logEl.removeChild(logEl.lastChild);
  }

  function applyPassiveDrain(dSol) {
    resources.fuel  = Math.max(0, resources.fuel  - dSol * 0.05);
    resources.power = Math.max(0, resources.power - dSol * 0.15);
    resources.hull  = Math.max(0, resources.hull  - dSol * 0.03);
    resources.data  = Math.min(100, resources.data + dSol * 0.08);
  }

  // ---- events ----

  function fireEvent() {
    const pool = events;
    if (pool.length === 0) return;

    let available = pool.filter(e => !sim.usedEvents.has(e.id));
    if (available.length === 0) {
      sim.usedEvents.clear();
      available = pool;
    }

    const totalWeight = available.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * totalWeight;
    let ev = available[0];
    for (const e of available) {
      r -= (e.weight || 1);
      if (r <= 0) { ev = e; break; }
    }

    sim.usedEvents.add(ev.id);
    showEvent(ev);
  }

  function showEvent(ev) {
    sim.eventOpen = true;
    sim.paused = true;
    updatePauseBtn();
    eventFlash = 0.35;
    modalEl.style.display = 'flex';

    modalEl.innerHTML = '<div class="event-card-lg">' +
      '<div class="event-header-lg">' +
      '<div class="event-title-lg">' + ev.title + '</div>' +
      '<div class="event-kicker">SOL ' + sim.sol + '</div>' +
      '</div>' +
      '<div class="event-desc-lg">' + ev.description + '</div>' +
      '<div class="event-choices-lg">' +
      ev.choices.map((c, i) => '<button class="event-choice-lg" data-index="' + i + '">' +
        '<div class="choice-text">' + c.text + '</div>' +
        '<div class="choice-effects">' + formatEffects(c.effects) + '</div>' +
        '</button>').join('') +
      '</div></div>';

    modalEl.querySelectorAll('.event-choice-lg').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        resolveEvent(ev, ev.choices[idx]);
      });
    });
  }

  function formatEffects(effects) {
    const map = { fuel: 'FUEL', power: 'POWER', hull: 'HULL', data: 'DATA' };
    const parts = [];
    for (const k of Object.keys(effects)) {
      const v = effects[k];
      if (v === 0) continue;
      const sign = v > 0 ? '+' : '';
      const cls = v > 0 ? 'eff-good' : 'eff-bad';
      parts.push('<span class="' + cls + '">' + sign + v + ' ' + map[k] + '</span>');
    }
    return parts.join(' · ');
  }

  function resolveEvent(ev, choice) {
    const effects = choice.effects || {};
    for (const k of Object.keys(effects)) {
      if (k in resources) {
        resources[k] = Math.max(0, Math.min(100, resources[k] + effects[k]));
      }
    }

    addLog(ev.title + ': ' + choice.outcome, 'event');
    renderResources();

    modalEl.innerHTML = '<div class="event-card-lg">' +
      '<div class="event-header-lg">' +
      '<div class="event-title-lg">' + ev.title + '</div>' +
      '<div class="event-kicker">SOL ' + sim.sol + '</div>' +
      '</div>' +
      '<div class="event-outcome">' + choice.outcome + '</div>' +
      '<button class="btn-primary" id="event-continue">CONTINUE</button>' +
      '</div>';

    modalEl.querySelector('#event-continue').addEventListener('click', () => {
      modalEl.style.display = 'none';
      sim.eventOpen = false;
      sim.paused = false;
      updatePauseBtn();
      checkEnd();
    });
  }

  // ---- end conditions ----

  function checkEnd() {
    if (sim.ended) return;
    if (resources.fuel <= 0) return endFlight('out_of_fuel', 'Ran out of fuel on the outbound leg.');
    if (resources.power <= 0) return endFlight('power_lost', 'Power failed. Spacecraft could not continue.');
    if (resources.hull <= 0) return endFlight('hull_lost', 'Structural failure. Spacecraft lost.');
    if (sim.sol >= sim.totalSols) return endFlight('arrived', 'Spacecraft reached the target.');
  }

  function endFlight(reason, text) {
    sim.ended = true;
    sim.paused = true;
    updatePauseBtn();

    state.flight = state.flight || {};
    state.flight.result = {
      reason,
      text,
      resources: { fuel: resources.fuel, power: resources.power, hull: resources.hull, data: resources.data },
      dataCollected: Math.round(resources.data),
      solsFlown: sim.sol,
    };

    addLog('CRUISE ENDED: ' + text, reason === 'arrived' ? 'success' : 'fail');

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'debrief' }));
    }, 1500);
  }

  // ---- main loop ----

  let running = true;
  let lastTime = performance.now();

  function loop(now) {
    if (!running) return;
    if (!document.body.contains(canvas)) { running = false; return; }

    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (!sim.paused && !sim.ended) {
      const solDelta = dt * sim.speed * 2;
      const newSol = Math.min(sim.totalSols, sim.sol + solDelta);
      applyPassiveDrain(newSol - sim.sol);
      sim.sol = newSol;

      solEl.textContent = Math.floor(sim.sol);
      progressEl.style.width = (sim.sol / sim.totalSols * 100) + '%';
      renderResources();

      if (sim.sol >= sim.nextEventSol && !sim.eventOpen) {
        sim.nextEventSol = sim.sol + 8 + Math.random() * 12;
        fireEvent();
      }

      checkEnd();
    }

    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- controls ----

  function updatePauseBtn() {
    pauseBtn.textContent = sim.paused ? 'RESUME' : 'PAUSE';
    pauseBtn.classList.toggle('paused', sim.paused);
  }

  root.querySelectorAll('.time-btn[data-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      sim.speed = parseInt(btn.dataset.speed, 10);
      root.querySelectorAll('.time-btn[data-speed]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  pauseBtn.addEventListener('click', () => {
    if (sim.ended || sim.eventOpen) return;
    sim.paused = !sim.paused;
    updatePauseBtn();
  });

  // ---- init ----

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  renderResources();
  requestAnimationFrame(() => resize());
}