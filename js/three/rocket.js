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

// Slots that detonate on impact when a failed rocket collapses.
const EXPLOSIVE_SLOTS = new Set([
  'engine_cluster', 'fuel_tank', 'oxidizer_tank', 'upper_engine', 'upper_tank',
]);

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
    nextParent.userData.isNextParent = true;
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

  const layers = [
    { scale: 1.15, length: 1.00, color: 0xd14010, opacity: 0.35 },
    { scale: 1.00, length: 0.92, color: 0xff6a1a, opacity: 0.55 },
    { scale: 0.85, length: 0.80, color: 0xffaa33, opacity: 0.72 },
    { scale: 0.65, length: 0.65, color: 0xffdd66, opacity: 0.85 },
    { scale: 0.40, length: 0.50, color: 0xffffff, opacity: 0.95 },
  ];

  const meshes = [];
  for (const l of layers) {
    const geo = new THREE.ConeGeometry(exitR * l.scale, bellHeight * l.length, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: l.color,
      transparent: true,
      opacity: l.opacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.rotation.x = Math.PI;
    cone.position.y = -bellHeight * l.length * 0.5;
    g.add(cone);
    meshes.push({ mesh: cone, baseOpacity: l.opacity });
  }

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff8822,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(exitR * 2.4, 32), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -bellHeight * 1.05;
  g.add(glow);

  const light = new THREE.PointLight(0xff8822, 0, 12);
  light.position.y = -bellHeight * 0.5;
  g.add(light);

  g.visible = false;
  g.userData.meshes = meshes;
  g.userData.glow = glow;
  g.userData.light = light;
  g.userData.baseLightIntensity = 3;
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

  const fireballSpecs = [
    { color: 0xfff2a0, opacity: 1.0, scaleRate: 3.5, size: 0.5 },
    { color: 0xff9933, opacity: 0.9, scaleRate: 5.5, size: 0.85 },
    { color: 0xd63300, opacity: 0.75, scaleRate: 7.5, size: 1.2 },
  ];
  const fireballs = [];
  for (const s of fireballSpecs) {
    const mat = new THREE.MeshBasicMaterial({
      color: s.color,
      transparent: true,
      opacity: s.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s.size, 24, 18), mat);
    ball.userData = { scaleRate: s.scaleRate, baseOpacity: s.opacity };
    group.add(ball);
    fireballs.push(ball);
  }

  const ringGeo = new THREE.RingGeometry(0.2, 0.6, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockwave = new THREE.Mesh(ringGeo, ringMat);
  shockwave.rotation.x = -Math.PI / 2;
  group.add(shockwave);

  const sparks = [];
  for (let i = 0; i < 30; i++) {
    const sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffdd66,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    const angle = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * Math.PI;
    const speed = (7 + Math.random() * 14) * intensity;
    spark.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * Math.cos(pitch) * speed,
      Math.abs(Math.sin(pitch)) * speed * 0.6 + 3,
      Math.sin(angle) * Math.cos(pitch) * speed
    );
    group.add(spark);
    sparks.push(spark);
  }

  const debris = [];
  const debrisColors = [0x2a2a34, 0x1a1a22, 0xd8d8e0, 0x6a6a78, 0xb87333, 0xffaa33];
  for (let i = 0; i < 26; i++) {
    const size = 0.12 + Math.random() * 0.55;
    const geo = Math.random() < 0.5
      ? new THREE.BoxGeometry(size, size * 0.6, size * 0.8)
      : new THREE.TetrahedronGeometry(size * 0.8);
    const mat = new THREE.MeshStandardMaterial({
      color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
      metalness: 0.5 + Math.random() * 0.4,
      roughness: 0.3 + Math.random() * 0.5,
      emissive: Math.random() < 0.3 ? 0x441100 : 0x000000,
      emissiveIntensity: 0.6,
    });
    const d = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const speed = (5 + Math.random() * 12) * intensity;
    d.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed * 0.8,
      (4 + Math.random() * 14) * intensity,
      Math.sin(angle) * speed * 0.8
    );
    d.userData.rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 22,
      (Math.random() - 0.5) * 22
    );
    group.add(d);
    debris.push(d);
  }

  const light = new THREE.PointLight(0xffaa55, 12 * intensity, 50 * intensity);
  group.add(light);

  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), smokeMat);
  group.add(smoke);

  const start = performance.now();
  const DURATION = 4500;
  let animId = null;
  let lastT = start;

  const loop = () => {
    const now = performance.now();
    const elapsed = now - start;
    const t = elapsed / DURATION;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (t >= 1) {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      return;
    }

    for (const ball of fireballs) {
      const rate = ball.userData.scaleRate;
      ball.scale.setScalar(1 + t * rate * intensity);
      ball.material.opacity = Math.max(0, ball.userData.baseOpacity * (1 - t * 1.9));
    }

    shockwave.scale.setScalar(1 + t * 14 * intensity);
    ringMat.opacity = Math.max(0, 0.95 * (1 - t * 3.2));

    for (const s of sparks) {
      s.position.addScaledVector(s.userData.velocity, dt);
      s.userData.velocity.y -= 12 * dt;
      s.material.opacity = Math.max(0, 1 - t * 1.6);
      s.scale.setScalar(Math.max(0.1, 1 - t * 1.3));
    }

    for (const d of debris) {
      d.position.addScaledVector(d.userData.velocity, dt);
      d.userData.velocity.y -= 15 * dt;
      d.rotation.x += d.userData.rotSpeed.x * dt;
      d.rotation.y += d.userData.rotSpeed.y * dt;
      d.rotation.z += d.userData.rotSpeed.z * dt;
      if (d.position.y < 0) {
        d.position.y = 0;
        d.userData.velocity.y *= -0.3;
        d.userData.velocity.x *= 0.7;
        d.userData.velocity.z *= 0.7;
      }
    }

    light.intensity = Math.max(0, (12 * intensity) * (1 - t * 2.8));

    smoke.scale.setScalar(1 + t * 3.2 * intensity);
    smokeMat.opacity = Math.max(0, 0.55 * (1 - t * 1.1));

    animId = requestAnimationFrame(loop);
  };

  animId = requestAnimationFrame(loop);

  return () => {
    if (animId) cancelAnimationFrame(animId);
    scene.remove(group);
  };
}

// =========================================================
// COLLAPSE (when a rocket cannot fly)
// =========================================================
// Empty wireframes vanish. Real hardware falls. Explosive parts detonate
// on ground contact. Ground collision uses the rotated bounding box, so
// nothing clips through the surface.
export function collapseRocket(rocketGroup, supportGroup, scene) {
  const segments = rocketGroup.userData.segments || [];
  if (segments.length === 0) return;

  rocketGroup.updateMatrixWorld(true);

  const pieces = [];
  const placeholders = [];

  for (const seg of segments) {
    let slotMesh = null;
    for (const child of seg.children) {
      if (child.userData && (child.userData.isPart || child.userData.isPlaceholder)) {
        slotMesh = child;
        break;
      }
    }

    if (!slotMesh || slotMesh.userData.isPlaceholder) {
      placeholders.push(seg);
      continue;
    }

    const h = seg.userData.height || slotMesh.userData.height || 1;
    const d = slotMesh.userData.diameter || h;

    // Re-center the mesh on the segment origin so rotation happens around
    // the geometric center rather than the base.
    slotMesh.position.y = 0;

    const wp = new THREE.Vector3();
    seg.getWorldPosition(wp);
    wp.y += h / 2;

    pieces.push({
      seg,
      position: wp.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        -0.3 - Math.random() * 0.5,
        (Math.random() - 0.5) * 2.0
      ),
      rotation: new THREE.Euler(0, 0, 0),
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 2.5
      ),
      halfX: d / 2,
      halfY: h / 2,
      halfZ: d / 2,
      explosive: EXPLOSIVE_SLOTS.has(seg.userData.slot),
      exploded: false,
    });
  }

  // Empty wireframes just disappear.
  for (const p of placeholders) {
    if (p.parent) p.parent.remove(p);
    p.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }

  if (pieces.length === 0) return;

  // Detach pieces from the stack so upper segments don't follow lower ones.
  for (const piece of pieces) {
    const seg = piece.seg;

    const toRemove = [];
    seg.children.forEach(child => {
      if (child.userData && child.userData.isNextParent) toRemove.push(child);
    });
    toRemove.forEach(c => seg.remove(c));

    if (seg.parent) seg.parent.remove(seg);

    seg.position.copy(piece.position);
    seg.rotation.set(0, 0, 0);
    rocketGroup.add(seg);
  }

  const rotMatrix = new THREE.Matrix4();
  let lastTime = performance.now();
  const start = performance.now();
  const DURATION = 6000;

  function loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    for (const piece of pieces) {
      if (piece.exploded) continue;

      piece.velocity.y -= 9.8 * dt;
      piece.position.addScaledVector(piece.velocity, dt);
      piece.rotation.x += piece.rotVel.x * dt;
      piece.rotation.y += piece.rotVel.y * dt;
      piece.rotation.z += piece.rotVel.z * dt;

      piece.seg.position.copy(piece.position);
      piece.seg.rotation.copy(piece.rotation);

      // World Y extent of the rotated bounding box. Column-major storage
      // means the second row of the rotation matrix is e[1], e[5], e[9].
      rotMatrix.makeRotationFromEuler(piece.rotation);
      const e = rotMatrix.elements;
      const extentY =
        Math.abs(e[1]) * piece.halfX +
        Math.abs(e[5]) * piece.halfY +
        Math.abs(e[9]) * piece.halfZ;

      const minY = piece.position.y - extentY;

      if (minY < 0) {
        piece.position.y -= minY;
        piece.seg.position.copy(piece.position);

        if (piece.explosive) {
          piece.exploded = true;
          piece.seg.visible = false;

          const worldPos = new THREE.Vector3(
            rocketGroup.position.x + piece.position.x,
            rocketGroup.position.y + piece.position.y,
            rocketGroup.position.z + piece.position.z
          );

          const intensity = Math.min(1.6, 0.6 + piece.halfY * 0.25);
          spawnExplosion(scene, worldPos, intensity);
        } else {
          piece.velocity.y *= -0.28;
          piece.velocity.x *= 0.6;
          piece.velocity.z *= 0.6;
          piece.rotVel.multiplyScalar(0.6);

          if (Math.abs(piece.velocity.y) < 0.5) {
            piece.velocity.set(0, 0, 0);
            piece.rotVel.set(0, 0, 0);
          }
        }
      }
    }

    if (now - start < DURATION) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
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

  const bySlot = {};
  for (const p of installed) bySlot[p.slot] = p;
  const has = (slot) => !!bySlot[slot];

  const hasEngine = has('engine_cluster');
  const hasFuel = has('fuel_tank');
  const hasOx = has('oxidizer_tank');
  const hasThrust = has('thrust_structure');

  let twr = 0;
  if (hasEngine) {
    const engine = bySlot.engine_cluster;
    const mass = installed.reduce((s, p) => s + (p.mass_kg || 0), 0)
               + (template.baseStructuralMassKg || 0);
    twr = (engine.thrust_kN * 1000) / (mass * 9.81);
  }

  let mode = 'launch';
  let reason = '';

  if (!hasEngine) {
    mode = 'inert';
    reason = 'No engine installed. The vehicle cannot ignite.';
  } else if (!hasFuel || !hasOx) {
    mode = 'dry';
    reason = 'Engine has no propellant. It cannot fire.';
  } else if (!hasThrust) {
    mode = 'rip';
    reason = 'No thrust structure. Engine force will tear the tank base open.';
  } else if (twr < 1.0) {
    mode = 'stuck';
    reason = 'Thrust-to-weight below 1.0. The vehicle cannot lift off.';
  }

  const q = Math.min(1, Math.max(0, (twr - 1.0) / 0.5));
  const peakHeight = totalHeight * (0.4 + q * 0.5);

  const driftDirX = Math.random() > 0.5 ? 1 : -1;
  const driftDirZ = Math.random() > 0.5 ? 1 : -1;
  const driftAmount = q < 0.6 ? (1 - q) * totalHeight * 0.4 : 0;
  const tiltAmount = q < 0.6 ? (1 - q) * 0.3 : 0;

  const CLAMP_MS = 600;

  resetClamps(supportGroup);
  hideAllFlames(rocketGroup);
  rocketGroup.position.set(0, 0, 0);
  rocketGroup.rotation.set(0, 0, 0);
  rocketGroup.visible = true;

  const startTime = performance.now();
  let explosionSpawned = false;
  let explosionRef = null;
  let collapseTriggered = false;

  const loop = () => {
    const elapsed = performance.now() - startTime;

    // -------- INERT: no engine --------
    if (mode === 'inert') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
      } else if (elapsed < 1800) {
        retractClamps(supportGroup, 1);
        onPhase('silent');
      } else if (!collapseTriggered) {
        collapseTriggered = true;
        collapseRocket(rocketGroup, supportGroup, scene);
        onPhase('collapsed');
      } else if (elapsed > 5200) {
        rocketGroup.visible = true;
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    // -------- DRY: engine but no propellant --------
    if (mode === 'dry') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
      } else if (elapsed < 2200) {
        retractClamps(supportGroup, 1);
        if (Math.random() > 0.65) {
          const flames = showAllFlames(rocketGroup);
          for (const f of flames) {
            const s = 0.25 + Math.random() * 0.3;
            f.scale.set(s, s * 0.5, s);
          }
        } else {
          hideAllFlames(rocketGroup);
        }
        rocketGroup.position.x = Math.sin(elapsed * 0.05) * 0.04;
        rocketGroup.position.z = Math.cos(elapsed * 0.06) * 0.04;
        onPhase('sputtering');
      } else if (!collapseTriggered) {
        hideAllFlames(rocketGroup);
        collapseTriggered = true;
        collapseRocket(rocketGroup, supportGroup, scene);
        onPhase('collapsed');
      } else if (elapsed > 5600) {
        rocketGroup.visible = true;
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    // -------- RIP: engine + propellant, no thrust structure --------
    if (mode === 'rip') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
      } else if (elapsed < 1400) {
        retractClamps(supportGroup, 1);
        const flames = showAllFlames(rocketGroup);
        for (const f of flames) {
          const flick = 0.9 + Math.random() * 0.2;
          f.scale.set(flick, flick, flick);
        }
        rocketGroup.position.x = Math.sin(elapsed * 0.15) * 0.05;
        rocketGroup.position.z = Math.cos(elapsed * 0.15) * 0.05;
        onPhase('ignition');
      } else if (!explosionSpawned) {
        explosionSpawned = true;
        const worldPos = new THREE.Vector3();
        rocketGroup.getWorldPosition(worldPos);
        const intensity = template.sizeClassMax === 'S' ? 0.6
                        : template.sizeClassMax === 'M' ? 1.0
                        : template.sizeClassMax === 'L' ? 1.4 : 1.8;
        explosionRef = spawnExplosion(scene, worldPos, intensity);
        rocketGroup.visible = false;
        hideAllFlames(rocketGroup);
        onPhase('exploded');
      } else if (elapsed > 4200) {
        if (explosionRef) explosionRef();
        rocketGroup.visible = true;
        rocketGroup.position.set(0, 0, 0);
        rocketGroup.rotation.set(0, 0, 0);
        resetClamps(supportGroup);
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    // -------- STUCK: full fire but TWR < 1 --------
    if (mode === 'stuck') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
      } else if (elapsed < 2600) {
        retractClamps(supportGroup, 1);
        const flames = showAllFlames(rocketGroup);
        for (const f of flames) {
          const flick = 0.9 + Math.random() * 0.2;
          f.scale.set(flick, flick, flick);
        }
        rocketGroup.position.x = Math.sin(elapsed * 0.1) * 0.1;
        rocketGroup.position.z = Math.cos(elapsed * 0.12) * 0.1;
        onPhase('straining');
      } else if (!collapseTriggered) {
        hideAllFlames(rocketGroup);
        collapseTriggered = true;
        collapseRocket(rocketGroup, supportGroup, scene);
        onPhase('collapsed');
      } else if (elapsed > 7000) {
        rocketGroup.visible = true;
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    // -------- NORMAL LAUNCH --------
    if (elapsed < CLAMP_MS) {
      retractClamps(supportGroup, elapsed / CLAMP_MS);
      onPhase('clamps');
    } else if (elapsed < CLAMP_MS + 4000) {
      retractClamps(supportGroup, 1);
      const p = (elapsed - CLAMP_MS) / 4000;
      const flames = showAllFlames(rocketGroup);
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
    } else if (elapsed < CLAMP_MS + 4600) {
      const flames = showAllFlames(rocketGroup);
      for (const f of flames) {
        const flick = 0.85 + Math.random() * 0.3;
        f.scale.set(flick, flick * 0.95, flick);
      }
      rocketGroup.position.set(driftAmount * driftDirX, peakHeight, driftAmount * driftDirZ);
      onPhase('hover');
    } else if (elapsed < CLAMP_MS + 4600 + 4000) {
      const p = (elapsed - CLAMP_MS - 4600) / 4000;
      const flames = showAllFlames(rocketGroup);
      for (const f of flames) {
        const flick = 0.85 + Math.random() * 0.3;
        f.scale.set(flick, flick * 0.95, flick);
      }
      const y = peakHeight * (1 - easeIn(p));
      const x = driftAmount * driftDirX * (1 - easeIn(p));
      const z = driftAmount * driftDirZ * (1 - easeIn(p));
      rocketGroup.position.set(x, y, z);
      rocketGroup.rotation.z = tiltAmount * driftDirX * 0.5 * (1 - p);
      rocketGroup.rotation.x = tiltAmount * driftDirZ * 0.5 * (1 - p);
      onPhase('descent');
    } else if (elapsed < CLAMP_MS + 8600 + 800) {
      const p = (elapsed - CLAMP_MS - 8600) / 800;
      if (p < 0.5) {
        const flames = showAllFlames(rocketGroup);
        for (const f of flames) {
          const flick = 0.5 + Math.random() * 0.3;
          const sf = 1 - p * 2;
          f.scale.set(flick * sf, flick * sf * 0.6, flick * sf);
        }
      } else {
        hideAllFlames(rocketGroup);
      }
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      onPhase('touchdown');
    } else if (elapsed < CLAMP_MS + 8600 + 800 + 400) {
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      onPhase('landed');
    } else if (elapsed < CLAMP_MS + 8600 + 800 + 400 + 1300) {
      const p = (elapsed - CLAMP_MS - 8600 - 800 - 400) / 1300;
      reengageClamps(supportGroup, p);
      onPhase('recovering');
    } else {
      reengageClamps(supportGroup, 1);
      rocketGroup.position.set(0, 0, 0);
      rocketGroup.rotation.set(0, 0, 0);
      hideAllFlames(rocketGroup);
      onComplete(true, { quality: 1, twr, peakHeight, landClean: true, reason: 'Clean flight.' });
      activeLaunchId = null;
      return;
    }

    activeLaunchId = requestAnimationFrame(loop);
  };

  activeLaunchId = requestAnimationFrame(loop);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)  { return t * t * t; }