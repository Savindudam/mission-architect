import {
  state, installPart, removePart, setValidation, setFlex, totals,
} from '../engine/state.js';
import {
  checkMission, computeDesignPerformance,
} from '../engine/mission_check.js';
import { validate } from '../engine/validate.js';
import { computeFlex } from '../engine/flex.js';
import { createScene } from '../three/scene.js';
import {
  buildRocket, applyFlex,
  buildSupportTower, resetClamps,
  playLaunchSequence, playAscentSequence, hideAllFlames,
  computeFlightQuality, computeStackPositions,
} from '../three/rocket.js';
import { loadQuality } from '../three/quality.js';
import { showQualityModal } from './qualityModal.js';
import * as THREE from 'three';

const SLOT_LABELS = {
  engine_cluster:   'Engine Cluster',
  thrust_structure: 'Thrust Structure',
  oxidizer_tank:    'Oxidizer Tank',
  fuel_tank:        'Fuel Tank',
  intertank:        'Intertank Structure',
  pressurant:       'Pressurant System',
  grid_fins:        'Grid Fins',
  interstage:       'Interstage Adapter',
  separation:       'Separation System',
  upper_engine:     'Upper Stage Engine',
  upper_tank:       'Upper Stage Tank',
  avionics:         'Avionics Bay',
  power:            'Power System',
  payload:          'Payload',
  nose_cone:        'Nose Cone',
};

const SLOT_HINTS = {
  engine_cluster:   'Main engines. Sea-level optimised.',
  thrust_structure: 'Transfers engine thrust into the tank walls.',
  oxidizer_tank:    'LOX or N2O4. Required for combustion.',
  fuel_tank:        'RP-1, methane, or hydrogen.',
  intertank:        'Connects the fuel and oxidizer tanks structurally.',
  pressurant:       'Keeps tanks pressurised as propellant drains.',
  grid_fins:        'Atmospheric control surfaces.',
  interstage:       'Connects stage 1 and stage 2.',
  separation:       'Splits the stages at the right moment.',
  upper_engine:     'Vacuum-optimised engine.',
  upper_tank:       'High-efficiency upper stage tank.',
  avionics:         'Flight computer, IMU, star trackers.',
  power:            'Solar, RTG, or battery.',
  payload:          'Instruments, lander, or return capsule.',
  nose_cone:        'Aerodynamic cover.',
};

const SIZE_SCALE_MAP = { S: 0.65, M: 1.0, L: 1.45, XL: 2.0 };
const SIZE_ORDER = { S: 0, M: 1, L: 2, XL: 3 };

// =========================================================
// STRUCTURAL SUPPORT
// =========================================================

const STACK_ORDER = [
  'engine_cluster', 'thrust_structure', 'oxidizer_tank', 'fuel_tank',
  'intertank', 'pressurant', 'grid_fins', 'interstage', 'separation',
  'upper_engine', 'upper_tank', 'avionics', 'power', 'payload', 'nose_cone',
];

const SIDE_ATTACH = new Set(['grid_fins', 'power']);

function computeStackSupport(template, installed) {
  const bySlot = {};
  for (const p of installed) bySlot[p.slot] = p;

  const status = {};
  let chainIntact = true;

  for (const slot of STACK_ORDER) {
    if (!template.activeSlots.includes(slot)) continue;

    const hasPart = !!bySlot[slot];
    const isSideAttach = SIDE_ATTACH.has(slot);

    if (isSideAttach) {
      status[slot] = { hasPart, isSupported: chainIntact && hasPart };
      continue;
    }

    const isSupported = chainIntact && hasPart;
    status[slot] = { hasPart, isSupported };
    chainIntact = isSupported;
  }

  const orphans = STACK_ORDER.filter(
    s => status[s] && status[s].hasPart && !status[s].isSupported
  );

  return { status, orphans, firstOrphan: orphans[0] || null };
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// =========================================================
// BUILDER
// =========================================================

export function mountBuilder(root) {
  if (!state.template) {
    root.innerHTML = '<pre class="screen-error">No template selected.</pre>';
    return;
  }

  if (state.catalogue.length === 0) {
    root.innerHTML = '<pre class="screen-error">Catalogue empty. data/core/parts.json failed to load.</pre>';
    return;
  }

  const savedQuality = loadQuality();
  if (!savedQuality) {
    root.innerHTML = '';
    showQualityModal(root, 'medium', () => {
      mountBuilder(root);
    });
    return;
  }

  const template = state.template;

  root.innerHTML = `
    <div class="builder">
      <div class="builder-top">
        <div class="builder-top-left">
          <strong>${template.name.toUpperCase()}</strong>
          <span id="budget-line">SIZE ${template.sizeClassMax} · ${template.activeSlots.length} SLOTS · ${state.catalogue.length} PARTS</span>
        </div>
        <div class="builder-top-right">
          <button class="btn-secondary" id="btn-back">Change Mission</button>
          <button class="btn-secondary" id="btn-graphics">Graphics</button>
          <button class="btn-secondary" id="btn-save">Save Design</button>
          <button class="btn-secondary" id="btn-fire">Test Fire</button>
          <button class="btn-primary" id="btn-confirm" disabled>Launch Mission</button>
        </div>
      </div>

      ${state.mission ? `
      <div class="mission-hud" id="mission-hud">
        <div class="mission-hud-header">
          <span class="mission-hud-kicker">ACTIVE MISSION</span>
          <span class="mission-hud-name">${state.mission.name.toUpperCase()}</span>
          <span class="mission-hud-target">${state.mission.target}</span>
        </div>
        <div class="mission-hud-checks" id="mission-checks"></div>
      </div>
      ` : ''}

      <div class="builder-main">
        <aside class="builder-meters">
          <h2 class="bm-h2">MASS</h2>
          <div class="meter">
            <div class="meter-bar"><div class="meter-fill" id="m-mass"></div></div>
            <div class="meter-value" id="v-mass">0 kg</div>
          </div>

          <h2 class="bm-h2">COST</h2>
          <div class="meter">
            <div class="meter-bar"><div class="meter-fill" id="m-cost"></div></div>
            <div class="meter-value" id="v-cost">$0</div>
          </div>

          <h2 class="bm-h2">POWER</h2>
          <div class="meter">
            <div class="meter-bar"><div class="meter-fill" id="m-power"></div></div>
            <div class="meter-value" id="v-power">0 W</div>
          </div>

          <h2 class="bm-h2">FLEX</h2>
          <div class="meter">
            <div class="meter-bar"><div class="meter-fill" id="m-flex"></div></div>
            <div class="meter-value" id="v-flex">0%</div>
          </div>

          <h2 class="bm-h2" style="margin-top:24px">SLOTS</h2>
          <div id="slot-list" style="display:flex;flex-direction:column;gap:4px"></div>
        </aside>

        <div class="builder-canvas-wrap" id="canvas-wrap">
          <div class="builder-hint" id="canvas-hint">DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A SLOT</div>
        </div>

        <aside class="builder-parts" id="parts-panel"></aside>
      </div>

      <div class="builder-bottom">
        <div class="engineer-msg info" id="engineer-msg">Awaiting first part...</div>
      </div>
    </div>
  `;

  const wrap = root.querySelector('#canvas-wrap');
  const panel = root.querySelector('#parts-panel');
  const three = createScene(wrap, savedQuality);

  const supportGroup = new THREE.Group();
  three.scene.add(supportGroup);

  let selectedSlot = null;
  let currentHitboxes = [];
  let launchActive = false;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // ---- parts panel — event delegation ----

  panel.addEventListener('click', (evt) => {
    if (launchActive) return;

    const option = evt.target.closest('.part-option');
    if (option) {
      const id = option.dataset.id;
      const part = state.catalogue.find(x => x.id === id);
      if (!part) return;
      installPart(part);
      selectedSlot = part.slot;
      renderAll();
      return;
    }

    const removeBtn = evt.target.closest('#btn-remove');
    if (removeBtn && selectedSlot) {
      const installedHere = state.installed.find(p => p.slot === selectedSlot);
      if (installedHere) {
        removePart(installedHere.id);
        renderAll();
      }
    }
  });

  // ---- 3D view click handling ----

  function handleClick(evt) {
    if (launchActive) return;
    const rect = three.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, three.camera);

    const hits = raycaster.intersectObjects(currentHitboxes, false);
    selectedSlot = hits.length > 0 ? hits[0].object.userData.slot : null;
    renderPartsPanel();
    renderSlotList();
  }

  let downPos = null;
  three.renderer.domElement.addEventListener('pointerdown', (evt) => {
    downPos = { x: evt.clientX, y: evt.clientY };
  });
  three.renderer.domElement.addEventListener('pointerup', (evt) => {
    if (!downPos) return;
    const dx = evt.clientX - downPos.x;
    const dy = evt.clientY - downPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    downPos = null;
    if (dist > 5) return;
    handleClick(evt);
  });

  // ---- orphan drop ----

  function dropOrphans(support) {
    const segments = three.rocketGroup.userData.segments || [];
    if (segments.length === 0) return;

    const orphanSet = new Set(support.orphans);
    const toDrop = [];

    three.rocketGroup.updateMatrixWorld(true);

    for (const seg of segments) {
      const slot = seg.userData.slot;
      if (!orphanSet.has(slot)) continue;
      const wp = new THREE.Vector3();
      seg.getWorldPosition(wp);
      toDrop.push({ seg, wp, slot });
    }

    if (toDrop.length === 0) return;

    toDrop.forEach(({ seg, wp, slot }, i) => {
      if (seg.parent) seg.parent.remove(seg);
      three.rocketGroup.add(seg);

      seg.position.copy(wp);
      seg.rotation.set(0, 0, 0);

      const seed = hashCode(slot);
      const angle = ((seed % 628) / 100);
      const dir = (seed >> 8) % 2 === 0 ? 1 : -1;
      const roll = 1.25 + ((seed >> 16) % 40) / 100;

      const dist = 2.2 + i * 0.9;
      const d = seg.userData.diameter || 1;

      seg.position.x = wp.x + Math.cos(angle) * dist;
      seg.position.z = wp.z + Math.sin(angle) * dist;
      seg.position.y = d * 0.5;

      seg.rotation.y = angle;
      seg.rotation.z = dir * roll;
      seg.rotation.x = ((seed >> 24) % 20 - 10) / 100;
    });
  }

  // ---- rebuild rocket ----
  // NOTE: this function deliberately does NOT touch the camera.
  // The camera is only framed once, at the end of mountBuilder.

  function rebuildRocket() {
    const { hitboxes } = buildRocket(
      three.rocketGroup, template, state.installed
    );
    currentHitboxes = hitboxes;

    const flex = computeFlex(state.installed.map(p => ({
      id: p.id,
      name: p.name,
      mass_kg: p.mass_kg,
      dimensions: p.dimensions,
      stiffness: p.stiffness,
    })));
    setFlex(flex);
    applyFlex(three.rocketGroup, flex);

    const support = computeStackSupport(template, state.installed);
    dropOrphans(support);

    // Rebuild the support tower to match the current stack.
    const stack = computeStackPositions(template);
    const oxPos = stack.positions.oxidizer_tank;
    const totalHeight = three.rocketGroup.userData.totalHeight || 5;
    const clampY = oxPos ? oxPos.center : totalHeight * 0.35;

    const scale = SIZE_SCALE_MAP[template.sizeClassMax] || 1.0;
    const rocketDiameter = 1.5 * scale;
    buildSupportTower(supportGroup, template, clampY, rocketDiameter);

    three.enableShadows(three.rocketGroup);
    three.enableShadows(supportGroup);
  }

  // ---- slot list on the left ----

  function renderSlotList() {
    const el = root.querySelector('#slot-list');
    if (!el) return;

    const installed = new Map(state.installed.map(p => [p.slot, p]));
    const support = computeStackSupport(template, state.installed);
    const orphanSet = new Set(support.orphans);
    let html = '';

    for (const slot of template.activeSlots) {
      const p = installed.get(slot);
      const label = SLOT_LABELS[slot] || slot;
      const isSelected = selectedSlot === slot;
      const isOrphan = p && orphanSet.has(slot);

      let bg, border, color;
      if (isOrphan) {
        bg = 'rgba(239,68,68,0.14)';
        border = 'var(--bad)';
        color = 'var(--bad)';
      } else if (p) {
        bg = 'rgba(74,222,128,0.12)';
        border = 'var(--good)';
        color = 'var(--text)';
      } else if (isSelected) {
        bg = 'rgba(34,211,238,0.15)';
        border = 'var(--accent)';
        color = 'var(--accent)';
      } else {
        bg = 'var(--bg-3)';
        border = 'var(--border)';
        color = 'var(--text-dim)';
      }

      const mark = isOrphan ? ' ⚠' : (p ? ' ✓' : '');

      html += `
        <button class="slot-btn" data-slot="${slot}" ${launchActive ? 'disabled' : ''} style="
          background:${bg};border:1px solid ${border};color:${color};
          font-family:inherit;font-size:10px;letter-spacing:1px;
          padding:6px 8px;text-align:left;cursor:${launchActive ? 'not-allowed' : 'pointer'};
          opacity:${launchActive ? 0.6 : 1};
        ">${label}${mark}</button>
      `;
    }

    el.innerHTML = html;

    el.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (launchActive) return;
        selectedSlot = btn.dataset.slot;
        renderPartsPanel();
        renderSlotList();
      });
    });
  }

  // ---- parts panel on the right ----

  function renderPartsPanel() {
    if (!selectedSlot) {
      panel.innerHTML = `
        <div class="bp-slot-label">NO SLOT SELECTED</div>
        <div class="bp-slot-desc">Click any wireframe slot in the 3D view, or click a slot in the left panel.</div>
      `;
      return;
    }

    const label = SLOT_LABELS[selectedSlot] || selectedSlot;
    const hint = SLOT_HINTS[selectedSlot] || '';
    const installedHere = state.installed.find(p => p.slot === selectedSlot);
    const maxSize = SIZE_ORDER[template.sizeClassMax] ?? 3;

    const allForSlot = state.catalogue.filter(p => p.slot === selectedSlot);
    const fitting = allForSlot.filter(p => (SIZE_ORDER[p.size_class] ?? 0) <= maxSize);

    let optionsHtml = '';
    for (const p of allForSlot) {
      const tooBig = (SIZE_ORDER[p.size_class] ?? 0) > maxSize;
      const isInstalled = installedHere && installedHere.id === p.id;

      optionsHtml += `
        <div class="part-option ${tooBig ? 'too-big' : ''} ${isInstalled ? 'installed' : ''}" data-id="${p.id}">
          <div class="po-name">${p.name}${isInstalled ? ' — INSTALLED' : ''}</div>
          <div class="po-desc">${p.description}</div>
          <div class="po-stats">
            <span class="po-stat">MASS <strong>${p.mass_kg} kg</strong></span>
            <span class="po-stat">COST <strong>$${(p.cost_usd / 1e6).toFixed(0)}M</strong></span>
            <span class="po-stat">SIZE <strong>${p.size_class}</strong></span>
            ${tooBig ? '<span class="po-stat" style="color:var(--bad)">TOO BIG</span>' : ''}
          </div>
          <div class="po-heritage">${p.heritage}</div>
        </div>
      `;
    }

    if (allForSlot.length === 0) {
      optionsHtml = '<div class="bp-slot-desc" style="color:var(--bad)">No parts exist in the catalogue for this slot.</div>';
    }

    panel.innerHTML = `
      <div class="bp-slot-label">${label.toUpperCase()}</div>
      <div class="bp-slot-desc">${hint}</div>
      <div class="bp-slot-desc" style="color:var(--accent);margin-top:4px">
        ${fitting.length} available${allForSlot.length - fitting.length > 0 ? ' · ' + (allForSlot.length - fitting.length) + ' too big' : ''}
      </div>
      ${installedHere ? '<button class="bp-remove" id="btn-remove">Remove Current Part</button>' : ''}
      <div class="bp-list">${optionsHtml}</div>
    `;
  }

  // ---- meters ----

  function renderMeters() {
    if (!root.querySelector('#m-mass')) return;

    const t = totals();
    const budget = state.mission?.requirements?.maxCost_usd || 500000000;

    const massCap = state.mission?.requirements?.maxMass_kg || 40000;
    root.querySelector('#m-mass').style.width = Math.min(100, (t.mass / massCap) * 100) + '%';
    root.querySelector('#v-mass').textContent = t.mass.toLocaleString() + ' kg';

    const costPct = Math.min(100, (t.cost / budget) * 100);
    const costFill = root.querySelector('#m-cost');
    costFill.style.width = costPct + '%';
    costFill.classList.remove('warn', 'bad');
    if (costPct >= 95) costFill.classList.add('bad');
    else if (costPct >= 75) costFill.classList.add('warn');
    root.querySelector('#v-cost').textContent = '$' + (t.cost / 1e6).toFixed(0) + 'M';

    const powerPct = Math.min(100, (Math.abs(t.power) / 1000) * 100);
    root.querySelector('#m-power').style.width = powerPct + '%';
    root.querySelector('#v-power').textContent = t.power + ' W';

    const flexRatio = state.flex?.ratio ?? 0;
    const flexFill = root.querySelector('#m-flex');
    flexFill.style.width = (flexRatio * 100) + '%';
    flexFill.classList.remove('warn', 'bad');
    if (flexRatio > 0.7) flexFill.classList.add('bad');
    else if (flexRatio > 0.45) flexFill.classList.add('warn');
    root.querySelector('#v-flex').textContent = (flexRatio * 100).toFixed(0) + '%';
  }

  // ---- engineer message ----

  function renderEngineer() {
    const msg = root.querySelector('#engineer-msg');
    if (!msg) return;

    const support = computeStackSupport(template, state.installed);
    if (support.firstOrphan) {
      const label = (SLOT_LABELS[support.firstOrphan] || support.firstOrphan).toLowerCase();
      const count = support.orphans.length;
      msg.className = 'engineer-msg block';
      msg.textContent = count === 1
        ? `ENGINEER: No support under the ${label}. It has fallen off the stack.`
        : `ENGINEER: ${count} sections have no support and have fallen off the stack. Lowest is the ${label}.`;
      return;
    }

    const v = validate(state.installed, template, state.catalogue);
    setValidation(v);

    msg.className = 'engineer-msg';

    const fq = computeFlightQuality(state.installed, template);

    if (v.counts.block > 0 || v.counts.critical > 0 || fq.verdict.level === 'block') {
      const order = { block: 0, critical: 1, caution: 2, info: 3 };
      const sorted = [...v.faults].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
      const top = sorted[0];
      if (top && (v.counts.block > 0 || v.counts.critical > 0)) {
        msg.classList.add(top.severity);
        msg.textContent = 'ENGINEER: ' + top.message + (top.fix ? ' — ' + top.fix : '');
      } else {
        msg.classList.add('block');
        msg.textContent = 'ENGINEER: ' + fq.verdict.text;
      }
      return;
    }

    if (fq.verdict.level === 'good') {
      msg.classList.add('ok');
      msg.textContent = 'ENGINEER: ' + fq.verdict.text + ' Thrust-to-weight ' + fq.twr.toFixed(2) + '.';
    } else if (fq.verdict.level === 'caution') {
      msg.classList.add('caution');
      msg.textContent = 'ENGINEER: ' + fq.verdict.text;
    } else {
      msg.classList.add('critical');
      msg.textContent = 'ENGINEER: ' + fq.verdict.text;
    }
  }

  // ---- mission requirements panel ----

  function renderMissionPanel() {
    if (!state.mission) return;

    const checksEl = root.querySelector('#mission-checks');
    if (!checksEl) return;

    const perf = computeDesignPerformance();
    const result = checkMission(state.mission, perf);

    checksEl.innerHTML = result.checks.map(c => `
      <div class="mission-check ${c.pass ? 'pass' : 'fail'}">
        <span class="mission-check-label">${c.label}</span>
        <span class="mission-check-need">${c.need}</span>
        <span class="mission-check-have">${c.have}</span>
        <span class="mission-check-mark">${c.pass ? 'PASS' : 'FAIL'}</span>
      </div>
    `).join('');

    const launchBtn = root.querySelector('#btn-confirm');
    if (launchBtn && !launchActive) {
      const v = validate(state.installed, template, state.catalogue);
      const support = computeStackSupport(template, state.installed);
      const structuralBlock = support.orphans.length > 0;
      const designBlock = v.counts.block > 0 || v.counts.critical > 0;
      launchBtn.disabled = structuralBlock || designBlock || !result.allPass;
    }
  }

  // ---- one entry point for every redraw ----

  function renderAll() {
    rebuildRocket();
    renderSlotList();
    renderPartsPanel();
    renderMeters();
    renderEngineer();
    renderMissionPanel();
  }

  function lockButtons(locked) {
    ['btn-back', 'btn-graphics', 'btn-save', 'btn-fire', 'btn-confirm'].forEach(id => {
      const b = root.querySelector('#' + id);
      if (b) b.disabled = locked;
    });
  }

  // ---- top bar buttons ----

  root.querySelector('#btn-back').addEventListener('click', () => {
    if (launchActive) return;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'missions' }));
  });

  root.querySelector('#btn-graphics').addEventListener('click', () => {
    if (launchActive) return;
    showQualityModal(root, savedQuality, () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'builder' }));
    });
  });

  root.querySelector('#btn-save').addEventListener('click', () => {
    if (launchActive) return;
    const name = prompt('Name this design:');
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('savedRockets') || '{}');
    saved[name] = {
      templateId: template.id,
      parts: state.installed.map(p => p.id),
      savedAt: Date.now(),
    };
    localStorage.setItem('savedRockets', JSON.stringify(saved));
    alert('Saved as "' + name + '"');
  });

  // ---- test fire — hover-and-land check only ----

  root.querySelector('#btn-fire').addEventListener('click', () => {
    if (launchActive) return;

    const support = computeStackSupport(template, state.installed);
    if (support.orphans.length > 0) {
      const el = root.querySelector('#engineer-msg');
      if (el) {
        el.className = 'engineer-msg block';
        el.textContent = 'ENGINEER: Cannot test fire. Parts have fallen off the stack.';
      }
      return;
    }

    launchActive = true;
    lockButtons(true);

    const hint = root.querySelector('#canvas-hint');
    if (hint) hint.textContent = 'TEST FIRE ACTIVE';

    playLaunchSequence({
      rocketGroup: three.rocketGroup,
      supportGroup,
      scene: three.scene,
      camera: three.camera,
      controls: three.controls,
      template,
      installed: state.installed,
      onPhase: (phase) => {
        const el = root.querySelector('#engineer-msg');
        if (!el) return;
        el.className = 'engineer-msg info';

        if (phase === 'clamps')     el.textContent = 'ENGINEER: Clamps retracting...';
        if (phase === 'silent')     el.textContent = 'ENGINEER: No ignition. Vehicle is inert.';
        if (phase === 'sputtering') el.textContent = 'ENGINEER: Engine sputtering. No propellant feed.';
        if (phase === 'ignition')   el.textContent = 'ENGINEER: Ignition. Watching structural loads.';
        if (phase === 'straining')  el.textContent = 'ENGINEER: Vehicle straining. Thrust below weight.';
        if (phase === 'ascent')     el.textContent = 'ENGINEER: Vehicle ascending. Telemetry nominal.';
        if (phase === 'hover')      el.textContent = 'ENGINEER: Hovering. Holding attitude.';
        if (phase === 'descent')    el.textContent = 'ENGINEER: Descending under thrust.';
        if (phase === 'touchdown')  el.textContent = 'ENGINEER: Touchdown. Cutting thrust.';
        if (phase === 'landed')     el.textContent = 'ENGINEER: Vehicle on the pad.';
        if (phase === 'recovering') el.textContent = 'ENGINEER: Re-engaging clamps...';
        if (phase === 'collapsed')  el.textContent = 'ENGINEER: Structural collapse. Vehicle is lost.';
        if (phase === 'exploded')   el.textContent = 'ENGINEER: VEHICLE LOST.';
      },
      onComplete: (success, info) => {
        launchActive = false;
        lockButtons(false);

        const hint = root.querySelector('#canvas-hint');
        if (hint) hint.textContent = 'DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A SLOT';

        const el = root.querySelector('#engineer-msg');
        if (el) {
          if (success) {
            el.className = 'engineer-msg ok';
            el.textContent = 'ENGINEER: Test fire clean. Vehicle is ready for launch.';
          } else {
            el.className = 'engineer-msg block';
            el.textContent = 'ENGINEER: Test fire failed. ' + (info?.reason || '');
          }
        }

        renderEngineer();
        renderMissionPanel();
      },
    });
  });

  // ---- launch mission — full ascent into orbit ----

  root.querySelector('#btn-confirm').addEventListener('click', () => {
    if (launchActive) return;
    if (!state.mission) {
      alert('No mission selected.');
      return;
    }

    const support = computeStackSupport(template, state.installed);
    if (support.orphans.length > 0) {
      const el = root.querySelector('#engineer-msg');
      if (el) {
        el.className = 'engineer-msg block';
        el.textContent = 'ENGINEER: Cannot launch. Parts have fallen off the stack.';
      }
      return;
    }

    launchActive = true;
    lockButtons(true);

    const hint = root.querySelector('#canvas-hint');
    if (hint) hint.textContent = 'ASCENT IN PROGRESS';

    playAscentSequence({
      rocketGroup: three.rocketGroup,
      supportGroup,
      scene: three.scene,
      camera: three.camera,
      controls: three.controls,
      template,
      installed: state.installed,
      onPhase: (phase) => {
        const el = root.querySelector('#engineer-msg');
        if (!el) return;
        el.className = 'engineer-msg info';
        if (phase === 'clamps')   el.textContent = 'ENGINEER: Hold-down clamps released.';
        if (phase === 'ignition') el.textContent = 'ENGINEER: Main engine start. All systems nominal.';
        if (phase === 'liftoff')  el.textContent = 'ENGINEER: Liftoff. Tower cleared.';
        if (phase === 'maxq')     el.textContent = 'ENGINEER: Max-Q. Vehicle under aerodynamic load.';
        if (phase === 'engine')   el.textContent = 'ENGINEER: First stage still nominal.';
        if (phase === 'staging')  el.textContent = 'ENGINEER: Stage separation confirmed.';
        if (phase === 'upper')    el.textContent = 'ENGINEER: Second stage ignition. Coasting to insertion.';
        if (phase === 'coast')    el.textContent = 'ENGINEER: On orbit. Handing off to Mission Control.';
      },
      onComplete: (success, info) => {
        launchActive = false;
        lockButtons(false);

        const hint = root.querySelector('#canvas-hint');
        if (hint) hint.textContent = 'DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A SLOT';

        if (success) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'flight' }));
          }, 500);
        } else {
          const el = root.querySelector('#engineer-msg');
          if (el) {
            el.className = 'engineer-msg block';
            el.textContent = 'ENGINEER: Launch failed. ' + (info?.reason || 'Vehicle lost during ascent.');
          }

          if (!state.flight) state.flight = {};
          state.flight.result = {
            reason: 'aborted',
            text: info?.reason || 'Vehicle lost during ascent.',
            resources: { fuel: 0, power: 0, hull: 0, data: 0 },
            dataCollected: 0,
            solsFlown: 0,
          };

          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'debrief' }));
          }, 1800);
        }
      },
    });
  });

  // ---- first render ----

  renderAll();

  // ---- frame the rocket ONCE, after the first render ----
  // This is the only place the camera is touched during the builder's
  // lifetime. Installing or removing parts calls rebuildRocket() but
  // does not touch the camera, so the player's view is preserved.

  (function frameCameraOnce() {
    const totalHeight = three.rocketGroup.userData.totalHeight || 10;

    // Push controls target to the vertical middle of the stack.
    three.controls.target.set(0, totalHeight * 0.5, 0);

    // Place the camera at a 3/4 wide shot that fully contains the rocket
    // with margin on every side.
    three.camera.position.set(
      totalHeight * 1.8,
      totalHeight * 1.0,
      totalHeight * 2.2
    );

    three.controls.update();
  })();

  // ---- clean up when the screen unmounts ----

  const observer = new MutationObserver(() => {
    if (!document.body.contains(wrap)) {
      three.dispose();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}