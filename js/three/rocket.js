import * as THREE from 'three';
import { buildDetailedPart } from './parts3d.js';

const SLOT_ORDER = [
  'engine_cluster', 'thrust_structure', 'oxidizer_tank', 'fuel_tank',
  'intertank', 'pressurant', 'grid_fins', 'interstage', 'separation',
  'upper_engine', 'upper_tank', 'avionics', 'power', 'payload', 'nose_cone',
];

const SLOT_SHAPE_BASE = {
  engine_cluster:   { h: 1.8, d: 1.5 },
  thrust_structure: { h: 0.6, d: 1.5 },
  oxidizer_tank:    { h: 3.6, d: 1.5 },
  fuel_tank:        { h: 3.8, d: 1.5 },
  intertank:        { h: 0.8, d: 1.5 },
  pressurant:       { h: 0.55, d: 1.5 },
  grid_fins:        { h: 0.55, d: 1.8 },
  interstage:       { h: 1.5, d: 1.4 },
  separation:       { h: 0.3, d: 1.4 },
  upper_engine:     { h: 1.6, d: 1.2 },
  upper_tank:       { h: 2.8, d: 1.4 },
  avionics:         { h: 0.55, d: 1.2 },
  power:            { h: 0.5, d: 1.4 },
  payload:          { h: 0.8, d: 1.15 },
  nose_cone:        { h: 1.6, d: 1.4 },
};

const SIZE_SCALE = { S: 0.65, M: 1.0, L: 1.45, XL: 2.0 };

function getSlotShape(slot, sizeClassMax) {
  const base = SLOT_SHAPE_BASE[slot] || { h: 1, d: 1 };
  const s = SIZE_SCALE[sizeClassMax] || 1.0;
  return { h: base.h * s, d: base.d * s };
}

export function computeStackPositions(template) {
  const s = SIZE_SCALE[template.sizeClassMax] || 1.0;
  let y = 0;
  const positions = {};
  for (const slot of SLOT_ORDER) {
    if (!template.activeSlots.includes(slot)) continue;
    const base = SLOT_SHAPE_BASE[slot];
    if (!base) continue;
    const h = base.h * s;
    positions[slot] = { y0: y, y1: y + h, center: y + h / 2, h };
    y += h;
  }
  return { positions, totalHeight: y };
}

const SLOT_COLOR = {
  engine_cluster: 0x1f1f2a, thrust_structure: 0x6e6e7c, oxidizer_tank: 0x3fb5ff,
  fuel_tank: 0xffc23a, intertank: 0x8c8c9a, pressurant: 0xb4b4c0, grid_fins: 0x2a2a34,
  interstage: 0xd4d4dc, separation: 0xffd23a, upper_engine: 0x1f1f2a,
  upper_tank: 0xe8ecf0, avionics: 0x2472ff, power: 0xffcc22, payload: 0xff5522, nose_cone: 0xf0f0f4,
};

function geometryFor(type, h, d) {
  switch (type) {
    case 'cone':    return new THREE.ConeGeometry(d / 2, h, 32);
    case 'frustum': return new THREE.CylinderGeometry((d / 2) * 0.78, d / 2, h, 32);
    default:        return new THREE.CylinderGeometry(d / 2, d / 2, h, 32);
  }
}

function makePlaceholderMesh(slot, shape) {
  const geo = geometryFor('cylinder', shape.h, shape.d);
  const group = new THREE.Group();
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x0c0c18, transparent: true, opacity: 0.3, depthWrite: false,
  }));
  group.add(fill);
  const edges = new THREE.EdgesGeometry(geo, 1);
  const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color: 0x22d3ee, transparent: true, opacity: 0.75,
  }));
  group.add(outline);
  group.userData.slot = slot;
  group.userData.height = shape.h;
  group.userData.diameter = shape.d;
  group.userData.isPlaceholder = true;
  return group;
}

function makePartMesh(part, shape) {
  const detailed = buildDetailedPart(part, shape);
  if (detailed) {
    detailed.userData.slot = part.slot;
    detailed.userData.height = shape.h;
    detailed.userData.diameter = shape.d;
    detailed.userData.partId = part.id;
    detailed.userData.isPart = true;
    return detailed;
  }
  const geo = geometryFor('cylinder', shape.h, shape.d);
  const color = SLOT_COLOR[part.slot] || 0xcccccc;
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.slot = part.slot;
  mesh.userData.height = shape.h;
  mesh.userData.diameter = shape.d;
  mesh.userData.partId = part.id;
  mesh.userData.isPart = true;
  return mesh;
}

function makeHitbox(slot, h, d) {
  const geo = new THREE.CylinderGeometry(d / 2 + 1.2, d / 2 + 1.2, h, 12);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.slot = slot;
  return mesh;
}

export function buildRocket(rocketGroup, template, installedParts) {
  while (rocketGroup.children.length) {
    const c = rocketGroup.children.pop();
    c.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
  const installedBySlot = {};
  for (const p of installedParts) installedBySlot[p.slot] = p;
  const activeSlots = new Set(template.activeSlots);
  const hitboxes = [];
  const segments = [];
  let parent = rocketGroup;
  let totalHeight = 0;

  for (const slot of SLOT_ORDER) {
    if (!activeSlots.has(slot)) continue;
    const shape = getSlotShape(slot, template.sizeClassMax);
    const part = installedBySlot[slot];
    const slotMesh = part ? makePartMesh(part, shape) : makePlaceholderMesh(slot, shape);
    const h = shape.h;
    const d = shape.d;

    const seg = new THREE.Group();
    seg.userData.slot = slot;
    seg.userData.height = h;
    parent.add(seg);

    slotMesh.position.y = h / 2;
    seg.add(slotMesh);

    const hit = makeHitbox(slot, h, d);
    hit.position.y = h / 2;
    seg.add(hit);
    hitboxes.push(hit);

    const nextParent = new THREE.Group();
    nextParent.position.y = h;
    seg.add(nextParent);
    parent = nextParent;
    segments.push(seg);
    totalHeight += h;
  }

  rocketGroup.userData.segments = segments;
  rocketGroup.userData.totalHeight = totalHeight;
  rocketGroup.userData.hitboxes = hitboxes;

  return { segments, hitboxes, totalHeight };
}

export function applyFlex(rocketGroup, flexResult) {
  const segments = rocketGroup.userData.segments || [];
  const ratio = flexResult?.ratio || 0;
  const perSegAngle = ratio * 0.009;
  for (let i = 1; i < segments.length; i++) {
    segments[i].rotation.z = perSegAngle;
  }
}

// =========================================================
// SUPPORT TOWER
// =========================================================
export function buildSupportTower(supportGroup, template, clampY, rocketDiameter) {
  while (supportGroup.children.length) {
    const c = supportGroup.children.pop();
    c.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }

  const scale = SIZE_SCALE[template.sizeClassMax] || 1.0;
  const standoff = rocketDiameter * 0.5 + 1.6 * scale;
  const towerHeight = clampY + 1.2 * scale;

  const matSteel = new THREE.MeshStandardMaterial({ color: 0x3a3a48, metalness: 0.85, roughness: 0.35 });
  const matDark  = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.9, roughness: 0.3 });
  const matClamp = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 0.75, roughness: 0.4 });
  const matConcrete = new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.3, roughness: 0.9 });

  const baseW = standoff * 2.6;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(baseW * 0.62, baseW * 0.68, 0.35, 32), matConcrete);
  pad.position.y = -0.18;
  supportGroup.add(pad);

  const hazardRing = new THREE.Mesh(
    new THREE.TorusGeometry(baseW * 0.5, 0.06, 6, 48),
    new THREE.MeshStandardMaterial({ color: 0xffcc22, metalness: 0.5, roughness: 0.6 })
  );
  hazardRing.rotation.x = Math.PI / 2;
  hazardRing.position.y = 0.02;
  supportGroup.add(hazardRing);

  const pylons = [];

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const px = Math.cos(a) * standoff;
    const pz = Math.sin(a) * standoff;

    const pylon = new THREE.Group();
    pylon.position.set(px, 0, pz);
    pylon.rotation.y = -a;

    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 * scale, towerHeight, 0.4 * scale), matSteel);
    column.position.y = towerHeight / 2;
    pylon.add(column);

    const braces = Math.floor(towerHeight / 0.9);
    for (let b = 0; b < braces; b++) {
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 * scale, towerHeight / braces * 1.15, 0.08 * scale), matDark);
      brace.position.y = (b + 0.5) * (towerHeight / braces);
      brace.rotation.z = b % 2 === 0 ? 0.4 : -0.4;
      pylon.add(brace);
    }

    const baseBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * scale, 0.15, 0.9 * scale), matDark);
    baseBracket.position.y = 0.08;
    pylon.add(baseBracket);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.55 * scale, 0.2, 0.55 * scale), matDark);
    cap.position.y = towerHeight;
    pylon.add(cap);

    const clampPivot = new THREE.Group();
    clampPivot.position.set(0, clampY, 0);
    pylon.add(clampPivot);

    const reach = standoff - rocketDiameter * 0.5;

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(reach, 0.16 * scale, 0.16 * scale), matClamp);
    arm.position.x = -reach / 2;
    clampPivot.add(arm);

    const pistonOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09 * scale, 0.09 * scale, reach * 0.5, 12), matSteel);
    pistonOuter.rotation.z = Math.PI / 2;
    pistonOuter.position.set(-reach * 0.35, 0.22 * scale, 0);
    clampPivot.add(pistonOuter);

    const pistonInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, reach * 0.4, 10), matClamp);
    pistonInner.rotation.z = Math.PI / 2;
    pistonInner.position.set(-reach * 0.6, 0.22 * scale, 0);
    clampPivot.add(pistonInner);

    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 * scale, 0.55 * scale, 0.7 * scale), matClamp);
    jaw.position.x = -reach;
    clampPivot.add(jaw);

    const pad2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.45 * scale, 0.6 * scale),
      new THREE.MeshStandardMaterial({ color: 0x101014, metalness: 0.2, roughness: 0.9 }));
    pad2.position.x = -reach + 0.14 * scale;
    clampPivot.add(pad2);

    pylon.userData.clampPivot = clampPivot;
    pylon.userData.baseY = clampY;
    pylons.push(pylon);
    supportGroup.add(pylon);
  }

  supportGroup.userData.pylons = pylons;
  supportGroup.userData.towerHeight = towerHeight;
  supportGroup.userData.clampY = clampY;

  return { pylons, towerHeight };
}

export function retractClamps(supportGroup, t) {
  const pylons = supportGroup.userData.pylons || [];
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  for (const pylon of pylons) {
    const pivot = pylon.userData.clampPivot;
    if (!pivot) continue;
    pivot.rotation.z = -eased * 1.5;
    pivot.position.y = (pylon.userData.baseY ?? 0) + eased * 0.5;
  }
}

// Reverse of retract — clamps close back around the tank.
export function reengageClamps(supportGroup, t) {
  const pylons = supportGroup.userData.pylons || [];
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  for (const pylon of pylons) {
    const pivot = pylon.userData.clampPivot;
    if (!pivot) continue;
    pivot.rotation.z = -1.5 + eased * 1.5;
    pivot.position.y = (pylon.userData.baseY ?? 0) + (1 - eased) * 0.5;
  }
}

export function resetClamps(supportGroup) {
  const pylons = supportGroup.userData.pylons || [];
  for (const pylon of pylons) {
    const pivot = pylon.userData.clampPivot;
    if (!pivot) continue;
    pivot.rotation.z = 0;
    pivot.position.y = pylon.userData.baseY ?? 0;
  }
}

// =========================================================
// FLIGHT QUALITY
// =========================================================
export function computeFlightQuality(installed, template) {
  const bySlot = {};
  for (const p of installed) bySlot[p.slot] = p;

  const hasEngine = !!bySlot.engine_cluster;
  const hasThrust = !!bySlot.thrust_structure;
  const hasFuel = !!bySlot.fuel_tank;
  const hasOx = !!bySlot.oxidizer_tank;
  const hasAvionics = !!bySlot.avionics;

  const engine = bySlot.engine_cluster;
  const mass = installed.reduce((s, p) => s + (p.mass_kg || 0), 0)
             + (template.baseStructuralMassKg || 0);
  const twr = engine ? (engine.thrust_kN * 1000) / (mass * 9.81) : 0;

  let quality = 1.0;
  const issues = [];

  if (!hasEngine)   { quality -= 0.6; issues.push('no engine'); }
  if (!hasThrust)   { quality -= 0.25; issues.push('no thrust structure'); }
  if (!hasFuel)     { quality -= 0.25; issues.push('no fuel tank'); }
  if (!hasOx)       { quality -= 0.25; issues.push('no oxidizer tank'); }
  if (!hasAvionics) { quality -= 0.15; issues.push('no avionics'); }

  if (engine && twr < 1.0)      { quality -= 0.5; issues.push('thrust below weight'); }
  else if (engine && twr < 1.2) { quality -= 0.15; issues.push('marginal thrust-to-weight'); }

  let massAbove = 0;
  let flexPenalty = 0;
  for (let i = installed.length - 1; i >= 0; i--) {
    massAbove += installed[i].mass_kg || 0;
    flexPenalty += massAbove * (i + 1) * 0.002;
  }
  const flexRatio = Math.min(1, flexPenalty / 5);
  if (flexRatio > 0.5)      { quality -= 0.3; issues.push('structural flex'); }
  else if (flexRatio > 0.3) { quality -= 0.1; }

  quality = Math.max(0, Math.min(1, quality));

  let verdict;
  if (quality >= 0.85)      verdict = { level: 'good',    text: 'Cleared for flight. All systems nominal.' };
  else if (quality >= 0.6)  verdict = { level: 'caution', text: 'Flyable. Minor concerns: ' + issues.join(', ') + '.' };
  else if (quality >= 0.3)  verdict = { level: 'warn',    text: 'Risky flight. Major issues: ' + issues.join(', ') + '.' };
  else                      verdict = { level: 'block',   text: 'Not flight-ready. Will fail on the pad: ' + issues.join(', ') + '.' };

  return { quality, twr, flexRatio, issues, verdict, bySlot };
}

// =========================================================
// FLAMES
// =========================================================
function makeFlameGroup(exitR, bellHeight) {
  const g = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(exitR * 1.05, bellHeight * 0.9, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff7a1a, transparent: true, opacity: 0.75,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  outer.rotation.x = Math.PI;
  outer.position.y = -bellHeight * 0.45;
  g.add(outer);

  const mid = new THREE.Mesh(
    new THREE.ConeGeometry(exitR * 0.7, bellHeight * 0.7, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffcc44, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  mid.rotation.x = Math.PI;
  mid.position.y = -bellHeight * 0.35;
  g.add(mid);

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(exitR * 0.4, bellHeight * 0.5, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  core.rotation.x = Math.PI;
  core.position.y = -bellHeight * 0.25;
  g.add(core);

  g.visible = false;
  g.userData.meshes = [outer, mid, core];
  return g;
}

export function hideAllFlames(rocketGroup) {
  rocketGroup.traverse(obj => {
    if (obj.userData && obj.userData.flame) {
      obj.userData.flame.visible = false;
      obj.userData.flame.scale.set(1, 1, 1);
    }
  });
}

export function showAllFlames(rocketGroup, scaleFactor = 1.0) {
  const flames = [];
  rocketGroup.traverse(obj => {
    if (obj.userData && obj.userData.flame) {
      obj.userData.flame.visible = true;
      obj.userData.flame.userData.scaleFactor = scaleFactor;
      flames.push(obj.userData.flame);
    }
  });
  return flames;
}

// =========================================================
// EXPLOSION
// =========================================================
export function spawnExplosion(scene, worldPosition, intensity = 1.0) {
  const group = new THREE.Group();
  group.position.copy(worldPosition);
  scene.add(group);

  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xffcc44, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const fireball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), fireMat);
  group.add(fireball);

  const fireball2Mat = new THREE.MeshBasicMaterial({
    color: 0xff5522, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const fireball2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), fireball2Mat);
  group.add(fireball2);

  const light = new THREE.PointLight(0xffaa44, 4, 30);
  group.add(light);

  const debris = [];
  for (let i = 0; i < 18; i++) {
    const size = 0.15 + Math.random() * 0.4;
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 0.5, size * 0.8),
      new THREE.MeshStandardMaterial({
        color: Math.random() < 0.4 ? 0x2a2a34 : (Math.random() < 0.5 ? 0xd8d8e0 : 0xff8844),
        metalness: 0.7, roughness: 0.4,
      })
    );
    const angle = Math.random() * Math.PI * 2;
    const speed = (4 + Math.random() * 8) * intensity;
    d.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed * 0.7,
      (3 + Math.random() * 9) * intensity,
      Math.sin(angle) * speed * 0.7
    );
    d.userData.rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14
    );
    group.add(d);
    debris.push(d);
  }

  const start = performance.now();
  const DURATION = 3000;
  let animId = null;

  const loop = () => {
    const elapsed = performance.now() - start;
    const t = elapsed / DURATION;
    if (t >= 1) {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      return;
    }

    const scale = 1 + t * 5 * intensity;
    fireball.scale.setScalar(scale);
    fireball2.scale.setScalar(scale * 1.2);
    fireMat.opacity = Math.max(0, 1 - t * 1.6);
    fireball2Mat.opacity = Math.max(0, 0.85 - t * 1.5);
    light.intensity = Math.max(0, 4 * (1 - t * 3));

    if (t < 0.25) fireMat.color.setHex(0xffdd66);
    else if (t < 0.5) fireMat.color.setHex(0xff8833);
    else fireMat.color.setHex(0x442200);

    for (const d of debris) {
      d.position.addScaledVector(d.userData.velocity, 1 / 60);
      d.userData.velocity.y -= 9.8 / 60;
      d.rotation.x += d.userData.rotSpeed.x / 60;
      d.rotation.y += d.userData.rotSpeed.y / 60;
      d.rotation.z += d.userData.rotSpeed.z / 60;
      if (d.position.y < 0) {
        d.position.y = 0;
        d.userData.velocity.y *= -0.25;
        d.userData.velocity.x *= 0.65;
        d.userData.velocity.z *= 0.65;
      }
    }
    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);

  return () => {
    if (animId) cancelAnimationFrame(animId);
    scene.remove(group);
  };
}

// =========================================================
// LAUNCH SEQUENCE
// =========================================================
let activeLaunchId = null;

export function abortLaunch() {
  if (activeLaunchId) {
    cancelAnimationFrame(activeLaunchId);
    activeLaunchId = null;
  }
}

export function playLaunchSequence({
  rocketGroup,
  supportGroup,
  scene,
  template,
  installed,
  onPhase = () => {},
  onComplete = () => {},
}) {
  abortLaunch();

  const totalHeight = rocketGroup.userData.totalHeight || 5;
  const quality = computeFlightQuality(installed, template);
  const q = quality.quality;

  const hasEngine = !!quality.bySlot.engine_cluster;
  const hasThrust = !!quality.bySlot.thrust_structure;
  const hasFuel   = !!quality.bySlot.fuel_tank;
  const hasOx     = !!quality.bySlot.oxidizer_tank;

  // ---- Failure classification ----
  // Priority order (first match wins):
  // 1. No engine  → nothing happens at all
  // 2. Engine + no thrust structure → explosion at ignition
  // 3. Engine + thrust + no fuel and/or no oxidizer → small sputter, then small explosion
  // 4. TWR < 1.0 → engine fires, rocket strains, then explosion
  // 5. Otherwise → full flight
  let failure = null;
  if (!hasEngine) {
    failure = { type: 'no_engine', at: 3000, small: true,
      reason: 'No engine installed. The vehicle never ignited.' };
  } else if (!hasThrust) {
    failure = { type: 'no_thrust', at: 900, small: false,
      reason: 'No thrust structure. Engine force ripped through the tank base and detonated the propellant.' };
  } else if (!hasFuel && !hasOx) {
    failure = { type: 'no_propellant', at: 1800, small: true,
      reason: 'Engine ignited into an empty feed system. Residual propellant in the lines burned through the chamber.' };
  } else if (!hasFuel) {
    failure = { type: 'no_fuel', at: 1800, small: true,
      reason: 'No fuel tank. Engine ran oxidizer-rich and burned through the combustion chamber.' };
  } else if (!hasOx) {
    failure = { type: 'no_oxidizer', at: 1800, small: true,
      reason: 'No oxidizer tank. The engine could not sustain combustion and detonated on the pad.' };
  } else if (quality.twr < 1.0) {
    failure = { type: 'low_thrust', at: 3200, small: false,
      reason: 'Thrust-to-weight below 1.0. The vehicle could not lift off and the engine consumed the pad.' };
  }

  // ---- Successful flight altitues ----
  // Only reached if failure === null.
  const fullQuality = !failure && q >= 0.7;
  let peakHeight;
  if (q >= 0.85)      peakHeight = totalHeight * 0.9;
  else if (q >= 0.7)  peakHeight = totalHeight * 0.7;
  else                peakHeight = totalHeight * 0.45;

  const driftDirX = Math.random() > 0.5 ? 1 : -1;
  const driftDirZ = Math.random() > 0.5 ? 1 : -1;
  const driftAmount = fullQuality ? 0 : (1 - q) * totalHeight * 0.4;
  const tiltAmount = q < 0.6 ? (1 - q) * 0.4 : 0;

  // ---- Timeline ----
  const CLAMP_RETRACT_MS = 600;
  const ASCENT_MS = 4000;
  const HOVER_MS = 600;
  const DESCENT_MS = 4000;
  const TOUCHDOWN_MS = 800;     // settle on pad, cut flames
  const HOLD_MS = 400;          // brief pause before clamps come back
  const REENGAGE_MS = 1300;     // clamps close
  const FINAL_MS = 300;

  const TOTAL_SUCCESS_MS =
    CLAMP_RETRACT_MS + ASCENT_MS + HOVER_MS + DESCENT_MS + TOUCHDOWN_MS
    + HOLD_MS + REENGAGE_MS + FINAL_MS;

  const TOTAL_MS = failure ? failure.at + 1400 : TOTAL_SUCCESS_MS;

  resetClamps(supportGroup);
  hideAllFlames(rocketGroup);
  rocketGroup.position.set(0, 0, 0);
  rocketGroup.rotation.set(0, 0, 0);
  rocketGroup.visible = true;

  const startTime = performance.now();
  let explosionSpawned = false;
  let explosionRef = null;

  const loop = () => {
    const elapsed = performance.now() - startTime;

    // ---- FAILURE ----
    if (failure) {
      // Explosion trigger
      if (elapsed >= failure.at && !explosionSpawned) {
        explosionSpawned = true;
        const worldPos = new THREE.Vector3();
        rocketGroup.getWorldPosition(worldPos);
        const intensity = failure.small ? 0.55 : (template.sizeClassMax === 'S' ? 0.7 : template.sizeClassMax === 'M' ? 1.0 : 1.4);
        explosionRef = spawnExplosion(scene, worldPos, intensity);
        rocketGroup.visible = false;
        hideAllFlames(rocketGroup);
      }

      // Finish
      if (elapsed >= failure.at + 1400) {
        if (explosionRef) explosionRef();
        rocketGroup.visible = true;
        rocketGroup.position.set(0, 0, 0);
        rocketGroup.rotation.set(0, 0, 0);
        resetClamps(supportGroup);
        onComplete(false, {
          quality: q, twr: quality.twr,
          peakHeight: 0, landClean: false,
          reason: failure.reason,
          failureType: failure.type,
        });
        activeLaunchId = null;
        return;
      }

      // Pre-explosion behavior
      if (elapsed < CLAMP_RETRACT_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_RETRACT_MS);
        onPhase('clamps');
      } else if (elapsed < failure.at) {
        // Clamps fully retracted. Behavior depends on failure type.
        if (failure.type === 'no_engine') {
          // Nothing happens. Rocket sits.
          onPhase('silent');
        } else if (failure.type === 'no_thrust') {
          // Engines fire → immediate explosion
          const flames = showAllFlames(rocketGroup, 1.0);
          for (const f of flames) {
            const flick = 0.9 + Math.random() * 0.2;
            f.scale.set(flick, flick, flick);
          }
          onPhase('ignition');
        } else if (failure.type === 'no_propellant' || failure.type === 'no_fuel' || failure.type === 'no_oxidizer') {
          // Weak sputtering. Occasional flashes.
          if (Math.random() > 0.6) {
            const flames = showAllFlames(rocketGroup, 0.4);
            for (const f of flames) {
              const flick = 0.5 + Math.random() * 0.6;
              f.scale.set(flick * 0.5, flick * 0.4, flick * 0.5);
            }
          } else {
            hideAllFlames(rocketGroup);
          }
          rocketGroup.position.x = Math.sin(elapsed * 0.1) * 0.03;
          rocketGroup.position.z = Math.cos(elapsed * 0.11) * 0.03;
          onPhase('sputtering');
        } else if (failure.type === 'low_thrust') {
          // Full flames but no lift
          const flames = showAllFlames(rocketGroup, 1.0);
          for (const f of flames) {
            const flick = 0.9 + Math.random() * 0.2;
            f.scale.set(flick, flick, flick);
          }
          rocketGroup.position.x = Math.sin(elapsed * 0.08) * 0.08;
          rocketGroup.position.z = Math.cos(elapsed * 0.09) * 0.08;
          onPhase('straining');
        }
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    // ---- SUCCESS FLIGHT ----
    // Phase 1: Clamps retract
    if (elapsed < CLAMP_RETRACT_MS) {
      retractClamps(supportGroup, elapsed / CLAMP_RETRACT_MS);
      onPhase('clamps');
    }
    // Phase 2: Ascent
    else if (elapsed < CLAMP_RETRACT_MS + ASCENT_MS) {
      retractClamps(supportGroup, 1);
      const p = (elapsed - CLAMP_RETRACT_MS) / ASCENT_MS;
      const flames = showAllFlames(rocketGroup, 1.0);
      for (const f of flames) {
        const flick = 0.85 + Math.random() * 0.3;
        f.scale.set(flick, flick * 0.95, flick);
      }
      const y = peakHeight * easeOut(p);
      const x = driftAmount * driftDirX * easeOut(p);
      const z = driftAmount * driftDirZ * easeOut(p);
      rocketGroup.position.set(x, y, z);
      rocketGroup.rotation.z = tiltAmount * driftDirX * p * 0.5;
      rocketGroup.rotation.x = tiltAmount * driftDirZ * p * 0.5;
      onPhase('ascent');
    }
    // Phase 3: Hover
    else if (elapsed < CLAMP_RETRACT_MS + ASCENT_MS + HOVER_MS) {
      const flames = showAllFlames(rocketGroup, 1.0);
      for (const f of flames) {
        const flick = 0.85 + Math.random() * 0.3;
        f.scale.set(flick, flick * 0.95, flick);
      }
      rocketGroup.position.set(driftAmount * driftDirX, peakHeight, driftAmount * driftDirZ);
      rocketGroup.rotation.z = tiltAmount * driftDirX * 0.5;
      rocketGroup.rotation.x = tiltAmount * driftDirZ * 0.5;
      onPhase('hover');
    }
    // Phase 4: Descent
    else if (elapsed < CLAMP_RETRACT_MS + ASCENT_MS + HOVER_MS + DESCENT_MS) {
      const p = (elapsed - CLAMP_RETRACT_MS - ASCENT_MS - HOVER_MS) / DESCENT_MS;
      const flames = showAllFlames(rocketGroup, 1.0);
      for (const f of flames) {
        const flick = 0.85 + Math.random() * 0.3;
        f.scale.set(flick, flick * 0.95, flick);
      }
      // Always return to origin if fullQuality (no drift in the first place)
      const y = peakHeight * (1 - easeIn(p));
      const x = driftAmount * driftDirX * (1 - easeIn(p));
      const z = driftAmount * driftDirZ * (1 - easeIn(p));
      rocketGroup.position.set(x, y, z);
      rocketGroup.rotation.z = tiltAmount * driftDirX * 0.5 * (1 - p);
      rocketGroup.rotation.x = tiltAmount * driftDirZ * 0.5 * (1 - p);
      onPhase('descent');
    }
    // Phase 5: Touchdown (settle on pad, cut flames)
    else if (elapsed < CLAMP_RETRACT_MS + ASCENT_MS + HOVER_MS + DESCENT_MS + TOUCHDOWN_MS) {
      const p = (elapsed - CLAMP_RETRACT_MS - ASCENT_MS - HOVER_MS - DESCENT_MS) / TOUCHDOWN_MS;
      // Cut flames over first half
      if (p < 0.5) {
        const flames = showAllFlames(rocketGroup, 1 - p * 2);
        for (const f of flames) {
          const flick = 0.6 + Math.random() * 0.3;
          const sf = (1 - p * 2);
          f.scale.set(flick * sf, flick * sf * 0.7, flick * sf);
        }
      } else {
        hideAllFlames(rocketGroup);
      }
      // Exact origin
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      onPhase('touchdown');
    }
    // Phase 6: Brief hold
    else if (elapsed < CLAMP_RETRACT_MS + ASCENT_MS + HOVER_MS + DESCENT_MS + TOUCHDOWN_MS + HOLD_MS) {
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      hideAllFlames(rocketGroup);
      onPhase('landed');
    }
    // Phase 7: Re-engage clamps
    else if (elapsed < CLAMP_RETRACT_MS + ASCENT_MS + HOVER_MS + DESCENT_MS + TOUCHDOWN_MS + HOLD_MS + REENGAGE_MS) {
      const p = (elapsed - CLAMP_RETRACT_MS - ASCENT_MS - HOVER_MS - DESCENT_MS - TOUCHDOWN_MS - HOLD_MS) / REENGAGE_MS;
      reengageClamps(supportGroup, p);
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      onPhase('recovering');
    }
    // Phase 8: Final
    else {
      reengageClamps(supportGroup, 1);
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      hideAllFlames(rocketGroup);

      onComplete(true, {
        quality: q, twr: quality.twr,
        peakHeight, landClean: true,
        reason: 'Clean flight. Vehicle returned to the pad and clamps re-engaged.',
      });
      activeLaunchId = null;
      return;
    }

    activeLaunchId = requestAnimationFrame(loop);
  };

  activeLaunchId = requestAnimationFrame(loop);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)  { return t * t * t; }