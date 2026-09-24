import { state, installPart, removePart, setValidation, setFlex, totals } from '../engine/state.js';
import { validate } from '../engine/validate.js';
import { computeFlex } from '../engine/flex.js';
import { createScene } from '../three/scene.js';
import {
  buildRocket, applyFlex,
  buildSupportTower, resetClamps,
  playLaunchSequence, hideAllFlames, computeFlightQuality,
  computeStackPositions,
} from '../three/rocket.js';
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

export function mountBuilder(root) {
  if (!state.template) {
    root.innerHTML = '<pre class="screen-error">No template selected.</pre>';
    return;
  }

  const template = state.template;

  if (state.catalogue.length === 0) {
    root.innerHTML = '<pre class="screen-error">Catalogue empty. data/core/parts.json failed to load.</pre>';
    return;
  }

  root.innerHTML = `
    <div class="builder">
      <div class="builder-top">
        <div class="builder-top-left">
          <strong>${template.name.toUpperCase()}</strong>
          <span id="budget-line">SIZE ${template.sizeClassMax} · ${template.activeSlots.length} SLOTS · ${state.catalogue.length} PARTS</span>
         </div>
        <div class="builder-top-right">
          <button class="btn-secondary" id="btn-back">Change Family</button>
          <button class="btn-secondary" id="btn-save">Save Design</button>
          <button class="btn-secondary" id="btn-fire">Test Fire</button>
          <button class="btn-primary" id="btn-confirm" disabled>Confirm Design</button>
        </div>
      </div>

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
  const three = createScene(wrap);

  const supportGroup = new THREE.Group();
  three.scene.add(supportGroup);

  let selectedSlot = null;
  let currentHitboxes = [];
  let launchActive = false;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

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

  const SIZE_SCALE_MAP = { S: 0.65, M: 1.0, L: 1.45, XL: 2.0 };

  function rebuildRocket() {
    const { hitboxes, totalHeight } = buildRocket(three.rocketGroup, template, state.installed);
    currentHitboxes = hitboxes;

    const flex = computeFlex(state.installed.map(p => ({
      id: p.id, name: p.name, mass_kg: p.mass_kg,
      dimensions: p.dimensions, stiffness: p.stiffness,
    })));
    setFlex(flex);
    applyFlex(three.rocketGroup, flex);

    const stack = computeStackPositions(template);
    const oxPos = stack.positions.oxidizer_tank;
    const clampY = oxPos ? oxPos.center : totalHeight * 0.35;

    const scale = SIZE_SCALE_MAP[template.sizeClassMax] || 1.0;
    const rocketDiameter = 1.5 * scale;
    buildSupportTower(supportGroup, template, clampY, rocketDiameter);

    three.enableShadows(three.rocketGroup);
    three.enableShadows(supportGroup);

    three.controls.target.set(0, totalHeight / 2, 0);
    three.camera.position.set(totalHeight * 0.9, totalHeight * 0.7, totalHeight * 1.3);
    three.controls.update();
  }

  function renderSlotList() {
    const el = root.querySelector('#slot-list');
    if (!el) return;
    const installed = new Map(state.installed.map(p => [p.slot, p]));
    let html = '';
    for (const slot of template.activeSlots) {
      const p = installed.get(slot);
      const label = SLOT_LABELS[slot] || slot;
      const isSelected = selectedSlot === slot;
      const bg = p ? 'rgba(74,222,128,0.12)' : (isSelected ? 'rgba(34,211,238,0.15)' : 'var(--bg-3)');
      const border = p ? 'var(--good)' : (isSelected ? 'var(--accent)' : 'var(--border)');
      const color = p ? 'var(--text)' : (isSelected ? 'var(--accent)' : 'var(--text-dim)');
      html += `
        <button class="slot-btn" data-slot="${slot}" ${launchActive ? 'disabled' : ''} style="
          background:${bg};border:1px solid ${border};color:${color};
          font-family:inherit;font-size:10px;letter-spacing:1px;
          padding:6px 8px;text-align:left;cursor:${launchActive ? 'not-allowed' : 'pointer'};
          opacity:${launchActive ? 0.6 : 1};
        ">${label}${p ? ' ✓' : ''}</button>
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
    const sizeOrder = { S: 0, M: 1, L: 2, XL: 3 };
    const maxSize = sizeOrder[template.sizeClassMax] ?? 3;
    const allForSlot = state.catalogue.filter(p => p.slot === selectedSlot);
    const fitting = allForSlot.filter(p => (sizeOrder[p.size_class] ?? 0) <= maxSize);

    let optionsHtml = '';
    for (const p of allForSlot) {
      const tooBig = (sizeOrder[p.size_class] ?? 0) > maxSize;
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

  function renderMeters() {
    const t = totals();
    const budget = state.mission?.budget || 500000000;

    const massCap = 40000;
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

  function renderEngineer() {
    const v = validate(state.installed, template, state.catalogue);
    setValidation(v);
    const msg = root.querySelector('#engineer-msg');
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
      root.querySelector('#btn-confirm').disabled = true;
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
    root.querySelector('#btn-confirm').disabled = false;
  }

  function renderAll() {
    rebuildRocket();
    renderSlotList();
    renderPartsPanel();
    renderMeters();
    renderEngineer();
  }

  function lockButtons(locked) {
    ['btn-back', 'btn-save', 'btn-fire', 'btn-confirm'].forEach(id => {
      const b = root.querySelector('#' + id);
      if (b) b.disabled = locked;
    });
  }

  root.querySelector('#btn-fire').addEventListener('click', () => {
    if (launchActive) return;
    launchActive = true;
    lockButtons(true);
    const hint = root.querySelector('#canvas-hint');
    if (hint) hint.textContent = 'LAUNCH SEQUENCE ACTIVE';

    playLaunchSequence({
      rocketGroup: three.rocketGroup,
      supportGroup,
      scene: three.scene,
      template,
      installed: state.installed,
      onPhase: (phase) => {
        const el = root.querySelector('#engineer-msg');
        if (!el) return;
        el.className = 'engineer-msg info';
        if (phase === 'clamps')  el.textContent = 'ENGINEER: Clamps retracting...';
        if (phase === 'ascent')  el.textContent = 'ENGINEER: Vehicle ascending. Telemetry nominal.';
        if (phase === 'hover')   el.textContent = 'ENGINEER: Hovering. Holding attitude.';
        if (phase === 'descent') el.textContent = 'ENGINEER: Descending under thrust.';
        if (phase === 'settle')  el.textContent = 'ENGINEER: Settling on the pad...';
        if (phase === 'failing') el.textContent = 'ENGINEER: WARNING. Anomaly detected on the pad.';
        if (phase === 'exploded') el.textContent = 'ENGINEER: VEHICLE LOST.';
        if (phase === 'touchdown') el.textContent = 'ENGINEER: Touchdown. Cutting thrust.';
        if (phase === 'landed') el.textContent = 'ENGINEER: Vehicle on the pad.';
        if (phase === 'recovering') el.textContent = 'ENGINEER: Re-engaging clamps...';
      },
      onComplete: (success, info) => {
        launchActive = false;
        lockButtons(false);
        const hint = root.querySelector('#canvas-hint');
        if (hint) hint.textContent = 'DRAG TO ROTATE · SCROLL TO ZOOM · CLICK A SLOT';

        const el = root.querySelector('#engineer-msg');
        if (el) {
          el.className = 'engineer-msg ' + (success ? 'ok' : 'block');
          el.textContent = 'ENGINEER: ' + (success
            ? 'Clean flight. Vehicle returned to the pad. Design is flight-ready.'
            : 'Flight failed. ' + info.reason + ' Adjust the design and try again.');
        }
        renderEngineer();
      },
    });
  });

  root.querySelector('#btn-back').addEventListener('click', () => {
    if (launchActive) return;
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'rocketSelect' }));
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

    root.querySelector('#btn-confirm').addEventListener('click', () => {
    if (launchActive) return;
    playEngineBurn(three.rocketGroup, 800);
    setTimeout(() => {
      alert('Design confirmed. That is the end of the flow for now.');
    }, 900);
  });
  renderAll();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(wrap)) {
      three.dispose();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}