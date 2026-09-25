import { state } from '../engine/state.js';

// ---------------------------------------------------------------
// LANDING SEQUENCE
//
// Runs after a successful cruise. Shows the upper stage burning
// up on re-entry, the capsule separating, plasma heating, drogue
// and main chute deployment, and splashdown. Then fades to debrief.
//
// If the mission already failed during cruise, this screen never
// runs — flight.js goes straight to the debrief.
// ---------------------------------------------------------------

const PHASES = [
  { id: 'deorbit',    start: 0,     end: 3.0 },
  { id: 'entry',      start: 3.0,   end: 7.0 },
  { id: 'peak',       start: 7.0,   end: 10.0 },
  { id: 'blackout',   start: 10.0,  end: 12.0 },
  { id: 'drogue',     start: 12.0,  end: 14.0 },
  { id: 'main',       start: 14.0,  end: 17.0 },
  { id: 'splashdown', start: 17.0,  end: 19.5 },
  { id: 'settled',    start: 19.5,  end: 22.5 },
];

const TOTAL_DURATION = PHASES[PHASES.length - 1].end;

function phaseAt(t) {
  for (const p of PHASES) {
    if (t >= p.start && t < p.end) return p.id;
  }
  return 'settled';
}

// A rough altitude / velocity / g curve for the readouts. Not
// physically exact — tuned to feel right.
function descentTelemetry(t) {
  if (t < 3)   return { alt: 400, vel: 27500, g: 0,   label: 'ORBIT' };
  if (t < 7)   return { alt: 400 - (t - 3) * 95, vel: 27500 - (t - 3) * 4500, g: 1 + (t - 3) * 1.8, label: 'ENTRY INTERFACE' };
  if (t < 10)  return { alt: 20 - (t - 7) * 5, vel: 9500 - (t - 7) * 2400, g: 6.4, label: 'PEAK HEATING' };
  if (t < 12)  return { alt: 5, vel: 2300, g: 0.2, label: 'COMMS BLACKOUT' };
  if (t < 14)  return { alt: 5 - (t - 12) * 1.5, vel: 2300 - (t - 12) * 950, g: 2.0, label: 'DROGUE CHUTE' };
  if (t < 17)  return { alt: 2 - (t - 14) * 0.5, vel: 400 - (t - 14) * 110, g: 1.4, label: 'MAIN CHUTE' };
  if (t < 19.5) return { alt: 0.5 - (t - 17) * 0.2, vel: 70 - (t - 17) * 28, g: 1.1, label: 'SPLASHDOWN' };
  return { alt: 0, vel: 0, g: 1.0, label: 'RECOVERED' };
}

// ---------------------------------------------------------------
// Mount
// ---------------------------------------------------------------
export function mountLanding(root) {
  const mission = state.mission || { name: 'Mission', target: 'Earth' };

  root.innerHTML = `
    <div class="flight-screen landing-screen">
      <div class="flight-topbar">
        <div class="flight-header">
          <div class="flight-kicker">RETURN · ${(mission.name || 'MISSION').toUpperCase()}</div>
          <div class="flight-title">EARTH INTERFACE</div>
        </div>
        <div class="flight-sol">
          <span class="flight-sol-key">PHASE</span>
          <span class="flight-sol-value" id="landing-phase-label">DEORBIT</span>
        </div>
      </div>

      <div class="flight-canvas-wrap">
        <canvas id="landing-canvas"></canvas>

        <div class="landing-hud">
          <div class="landing-telemetry">
            <div class="landing-tele-row">
              <span class="landing-tele-key">ALT</span>
              <span class="landing-tele-val" id="tele-alt">400.0 km</span>
            </div>
            <div class="landing-tele-row">
              <span class="landing-tele-key">VEL</span>
              <span class="landing-tele-val" id="tele-vel">27,500 km/h</span>
            </div>
            <div class="landing-tele-row">
              <span class="landing-tele-key">G-FORCE</span>
              <span class="landing-tele-val" id="tele-g">0.0 g</span>
            </div>
          </div>

          <div class="landing-log" id="landing-log"></div>
        </div>

        <button class="landing-skip" id="landing-skip">SKIP ▸</button>
      </div>

      <div class="landing-fade" id="landing-fade"></div>
    </div>
  `;

  const canvas = root.querySelector('#landing-canvas');
  const ctx = canvas.getContext('2d');
  const fade = root.querySelector('#landing-fade');
  const phaseLabel = root.querySelector('#landing-phase-label');
  const altEl = root.querySelector('#tele-alt');
  const velEl = root.querySelector('#tele-vel');
  const gEl = root.querySelector('#tele-g');
  const logEl = root.querySelector('#landing-log');
  const skipBtn = root.querySelector('#landing-skip');

  const startTime = performance.now();
  let running = true;
  let lastPhase = '';

  // ---- background caches ----
  const stars = [];
  function generateStars(w, h) {
    stars.length = 0;
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        r: 0.4 + Math.random() * 1.4,
        a: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        rate: 0.6 + Math.random() * 1.4,
      });
    }
  }

  // ---- resize ----
  function resize() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    generateStars(canvas.width, canvas.height);
  }

  // ---- logging ----
  function log(text, type) {
    if (!logEl) return;
    const el = document.createElement('div');
    el.className = 'log-entry' + (type ? ' log-' + type : '');
    el.textContent = text;
    logEl.prepend(el);
    while (logEl.children.length > 8) logEl.removeChild(logEl.lastChild);
  }

  const PHASE_LOGS = {
    deorbit:    ['Deorbit burn complete. Upper stage jettisoned.', 'info'],
    entry:      ['Entry interface. Heat shield forward.', 'info'],
    peak:       ['Peak heating. Plasma sheath fully formed.', 'warn'],
    blackout:   ['COMMS BLACKOUT — plasma blocking telemetry.', 'warn'],
    drogue:     ['Drogue chute deployed at 5 km.', 'success'],
    main:       ['Main chute deployed. Descent nominal.', 'success'],
    splashdown: ['Touchdown in recovery zone.', 'success'],
    settled:    ['Capsule stable. Recovery crew inbound.', 'success'],
  };

  // ---- main render ----
  function draw(t, w, h) {
    const phase = phaseAt(t);
    const tele = descentTelemetry(t);

    // Altitude determines sky darkness. High = space. Low = sky.
    const altNorm = Math.max(0, Math.min(1, tele.alt / 400));
    const groundY = h * 0.86;

    // ---------- sky background ----------
    if (altNorm > 0.4) {
      // deep space
      ctx.fillStyle = '#000005';
      ctx.fillRect(0, 0, w, h);
    } else {
      // atmosphere — blend from dark to blue
      const skyBlend = 1 - altNorm / 0.4; // 0 at space, 1 at surface
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, mixColor('#000005', '#0a2a5a', skyBlend));
      grad.addColorStop(0.55, mixColor('#000010', '#3a80c0', skyBlend));
      grad.addColorStop(1, mixColor('#101020', '#7ab0e0', skyBlend));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);
    }

    // ---------- stars (fade out as altitude drops) ----------
    const starAlpha = Math.max(0, Math.min(1, (altNorm - 0.3) / 0.5));
    if (starAlpha > 0.01) {
      for (const s of stars) {
        const tw = 0.65 + 0.35 * Math.sin(performance.now() * 0.001 * s.rate + s.phase);
        ctx.fillStyle = `rgba(220, 235, 255, ${s.a * tw * starAlpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ---------- entry plasma trail (during entry phases) ----------
    if (phase === 'entry' || phase === 'peak' || phase === 'blackout') {
      let intensity = 0;
      if (phase === 'entry')   intensity = (t - 3) / 4;
      if (phase === 'peak')    intensity = 1.0;
      if (phase === 'blackout') intensity = 1 - (t - 10) / 2;

      const cx = w * 0.5;
      const cy = h * 0.42;

      // plasma trail above capsule
      const trailLen = 120 + intensity * 200;
      const trailGrad = ctx.createLinearGradient(cx, cy - trailLen, cx, cy);
      trailGrad.addColorStop(0, 'rgba(255, 140, 40, 0)');
      trailGrad.addColorStop(0.6, `rgba(255, 140, 40, ${0.35 * intensity})`);
      trailGrad.addColorStop(1, `rgba(255, 220, 120, ${0.9 * intensity})`);
      ctx.fillStyle = trailGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 40 - intensity * 20, cy - trailLen);
      ctx.lineTo(cx + 40 + intensity * 20, cy - trailLen);
      ctx.lineTo(cx + 22, cy);
      ctx.lineTo(cx - 22, cy);
      ctx.closePath();
      ctx.fill();

      // bright plasma sheath around heatshield
      const sheathR = 60 + intensity * 40;
      const sheath = ctx.createRadialGradient(cx, cy, 0, cx, cy, sheathR);
      sheath.addColorStop(0, `rgba(255, 255, 230, ${intensity})`);
      sheath.addColorStop(0.4, `rgba(255, 180, 60, ${intensity * 0.85})`);
      sheath.addColorStop(0.8, `rgba(220, 60, 20, ${intensity * 0.4})`);
      sheath.addColorStop(1, 'rgba(220, 60, 20, 0)');
      ctx.fillStyle = sheath;
      ctx.beginPath();
      ctx.arc(cx, cy, sheathR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------- upper stage burn-up (early entry) ----------
    if (phase === 'deorbit' || phase === 'entry') {
      const busY = h * 0.20 - (t - 0) * 4;
      const busAlpha = phase === 'deorbit' ? 1 : Math.max(0, 1 - (t - 3) / 2);
      if (busAlpha > 0.01) {
        // faint bus silhouette falling behind, breaking apart
        ctx.save();
        ctx.globalAlpha = busAlpha * 0.7;
        ctx.fillStyle = '#8a8a95';
        ctx.fillRect(w * 0.46, busY, 40, 10);
        ctx.fillRect(w * 0.47, busY + 12, 36, 4);
        ctx.restore();

        // small breakup sparks during entry
        if (phase === 'entry') {
          for (let i = 0; i < 8; i++) {
            const sx = w * 0.46 + Math.random() * 60;
            const sy = busY + Math.random() * 20;
            ctx.fillStyle = `rgba(255, 160, 60, ${busAlpha * (0.4 + Math.random() * 0.5)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // ---------- parachute phases ----------
    if (phase === 'drogue' || phase === 'main' || phase === 'splashdown' || phase === 'settled') {
      // Capsule position on screen
      let capsuleY = h * 0.42;
      if (phase === 'drogue')     capsuleY = h * 0.42 + (t - 12) * h * 0.15;
      if (phase === 'main')       capsuleY = h * 0.72 + (t - 14) * h * 0.04;
      if (phase === 'splashdown') capsuleY = groundY - 6 + (t - 17) * 2;
      if (phase === 'settled')    capsuleY = groundY - 6;

      const capsuleX = w * 0.5;

      // chute
      if (phase === 'drogue' || phase === 'main') {
        const isMain = phase === 'main';
        const chuteR = isMain ? 60 : 26;
        const chuteY = capsuleY - (isMain ? 130 : 80);
        const chuteColor = isMain ? '#f0f0f0' : '#d8c8a0';

        // canopy
        ctx.fillStyle = chuteColor;
        ctx.beginPath();
        ctx.arc(capsuleX, chuteY, chuteR, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        // canopy ribs
        ctx.strokeStyle = 'rgba(60, 60, 70, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const angle = Math.PI + (i + 1) * (Math.PI / 6);
          ctx.beginPath();
          ctx.moveTo(capsuleX, chuteY);
          ctx.lineTo(capsuleX + Math.cos(angle) * chuteR, chuteY + Math.sin(angle) * chuteR);
          ctx.stroke();
        }

        // chute lines
        ctx.strokeStyle = 'rgba(220, 220, 230, 0.8)';
        for (let i = 0; i < 4; i++) {
          const lineX = capsuleX - 20 + i * 13;
          ctx.beginPath();
          ctx.moveTo(lineX, capsuleY - 8);
          ctx.lineTo(capsuleX, chuteY + chuteR);
          ctx.stroke();
        }
      }

      // capsule body (teardrop)
      drawCapsule(ctx, capsuleX, capsuleY, phase === 'settled' || phase === 'splashdown');
    }

    // ---------- ocean / ground line ----------
    if (phase === 'main' || phase === 'splashdown' || phase === 'settled') {
      // ocean gradient
      const oceanGrad = ctx.createLinearGradient(0, groundY, 0, h);
      oceanGrad.addColorStop(0, '#1a4a70');
      oceanGrad.addColorStop(1, '#0a2038');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, groundY, w, h - groundY);

      // subtle wave lines
      const now = performance.now() * 0.001;
      ctx.strokeStyle = 'rgba(140, 200, 240, 0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const y = groundY + 12 + i * 14;
        ctx.beginPath();
        for (let x = 0; x < w; x += 8) {
          const wave = Math.sin(x * 0.02 + now * 1.2 + i) * 3;
          if (x === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }
    }

    // ---------- splash particles ----------
    if (phase === 'splashdown') {
      const dt = t - 17;
      if (dt < 1.2) {
        const cxp = w * 0.5;
        const cyp = groundY - 6;
        const count = Math.floor(20 * (1 - dt / 1.2));
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI - Math.PI;
          const speed = 40 + Math.random() * 60;
          const px = cxp + Math.cos(a) * speed * dt;
          const py = cyp + Math.sin(a) * speed * dt + dt * dt * 80;
          ctx.fillStyle = `rgba(220, 240, 255, ${0.8 - dt})`;
          ctx.beginPath();
          ctx.arc(px, py, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ---------- peak heating screen shake ----------
    if (phase === 'peak') {
      const intensity = 6;
      const sx = (Math.random() - 0.5) * intensity;
      const sy = (Math.random() - 0.5) * intensity;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.restore();
    }

    // ---------- blackout darkening ----------
    if (phase === 'blackout') {
      const blackout = 1 - Math.abs((t - 11) / 1);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * blackout})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawCapsule(ctx, x, y, floating) {
    // Heatshield (facing down)
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath();
    ctx.arc(x, y + 6, 20, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(x - 18, y - 20, x + 18, y + 4);
    grad.addColorStop(0, '#d8d8e0');
    grad.addColorStop(0.5, '#a8a8b0');
    grad.addColorStop(1, '#787880');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 20, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    // rim
    ctx.strokeStyle = '#5a5a68';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.stroke();

    // heatshield glow (still hot)
    if (!floating) {
      const glow = ctx.createRadialGradient(x, y + 10, 0, x, y + 10, 36);
      glow.addColorStop(0, 'rgba(255, 120, 40, 0.5)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y + 10, 36, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // small wave ripple under floating capsule
      const now = performance.now() * 0.003;
      ctx.strokeStyle = `rgba(200, 230, 255, ${0.4 + 0.2 * Math.sin(now)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 30 + Math.sin(now) * 3, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function mixColor(a, b, t) {
    const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16);
    const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ra + (rb - ra) * t);
    const g = Math.round(ga + (gb - ga) * t);
    const bl = Math.round(ba + (bb - ba) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  // ---- main loop ----
  let lastTime = performance.now();

  function loop(now) {
    if (!running) return;
    if (!document.body.contains(canvas)) { running = false; return; }

    const t = (now - startTime) / 1000;
    const w = canvas.width;
    const h = canvas.height;

    // update phase
    const phase = phaseAt(t);
    if (phase !== lastPhase) {
      lastPhase = phase;
      const labelMap = {
        deorbit: 'DEORBIT',
        entry: 'ENTRY INTERFACE',
        peak: 'PEAK HEATING',
        blackout: 'BLACKOUT',
        drogue: 'DROGUE CHUTE',
        main: 'MAIN CHUTE',
        splashdown: 'SPLASHDOWN',
        settled: 'RECOVERED',
      };
      if (phaseLabel) phaseLabel.textContent = labelMap[phase] || phase.toUpperCase();

      const entry = PHASE_LOGS[phase];
      if (entry) log(entry[0], entry[1]);
    }

    // update telemetry
    const tele = descentTelemetry(t);
    if (altEl) altEl.textContent = tele.alt < 10
      ? `${tele.alt.toFixed(2)} km`
      : `${Math.round(tele.alt)} km`;
    if (velEl) velEl.textContent = `${Math.round(tele.vel).toLocaleString()} km/h`;
    if (gEl)   gEl.textContent = `${tele.g.toFixed(1)} g`;

    draw(t, w, h);

    // fade to dark at the end
    if (t > TOTAL_DURATION - 2) {
      const fadeT = Math.max(0, Math.min(1, (t - (TOTAL_DURATION - 2)) / 2));
      if (fade) fade.style.opacity = String(fadeT);
    }

    // done
    if (t >= TOTAL_DURATION) {
      running = false;
      // ensure result exists for debrief
      if (!state.flight) state.flight = {};
      if (!state.flight.result) {
        state.flight.result = { reason: 'arrived', text: 'Capsule recovered.' };
      } else {
        state.flight.result.reason = 'arrived';
        state.flight.result.text = 'Capsule recovered.';
      }
      // score computed in debrief
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'debrief' }));
      return;
    }

    requestAnimationFrame(loop);
  }

  // ---- skip button ----
  skipBtn.addEventListener('click', () => {
    running = false;
    if (!state.flight) state.flight = {};
    if (!state.flight.result) state.flight.result = {};
    state.flight.result.reason = 'arrived';
    state.flight.result.text = 'Capsule recovered.';
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'debrief' }));
  });

  // ---- init ----
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  requestAnimationFrame(resize);
  requestAnimationFrame(loop);

  // cleanup
  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      running = false;
      ro.disconnect();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}