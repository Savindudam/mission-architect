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
    seg.userData.diameter = d;
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
    seg.userData.nextParent = nextParent;
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

// FLAMES
function makeFlameGroup(exitR, bellHeight) {
  const g = new THREE.Group();

  const layers = [
    { scale: 1.15, length: 1.00, color: 0xd14010, opacity: 0.32 },
    { scale: 1.00, length: 0.92, color: 0xff6a1a, opacity: 0.48 },
    { scale: 0.85, length: 0.80, color: 0xffaa33, opacity: 0.60 },
    { scale: 0.65, length: 0.65, color: 0xffdd66, opacity: 0.62 },
    { scale: 0.40, length: 0.50, color: 0xffeedd, opacity: 0.42 },
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
    opacity: 0.35,
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
  g.userData.baseGlowOpacity = 0.35;
  g.userData.baseLightIntensity = 2;
  return g;
}
// =========================================================
// CONTRAIL — glowing trail that follows the rocket
// =========================================================
function makeContrailTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,   'rgba(255, 255, 255, 1.0)');
  g.addColorStop(0.3, 'rgba(255, 230, 200, 0.7)');
  g.addColorStop(0.6, 'rgba(220, 190, 160, 0.25)');
  g.addColorStop(1,   'rgba(200, 180, 160, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createContrail(scene, maxParticles = 500) {
  const MAX = maxParticles;
  const LIFETIME = 5.5; // seconds

  const positions = new Float32Array(MAX * 3);
  const sizes = new Float32Array(MAX);
  const alphas = new Float32Array(MAX);
  const ages = new Float32Array(MAX).fill(999);
  const vels = new Float32Array(MAX * 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      tex: { value: makeContrailTexture() },
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (400.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D tex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(tex, gl_PointCoord);
        gl_FragColor = vec4(t.rgb, t.a * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;

  return {
    points,

    spawn(x, y, z, vx = 0, vy = 0, vz = 0, sizeHint = 1) {
      const i = cursor;
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      vels[i * 3 + 0] = vx;
      vels[i * 3 + 1] = vy;
      vels[i * 3 + 2] = vz;
      sizes[i] = sizeHint;
      alphas[i] = 0.9;
      ages[i] = 0;
      cursor = (cursor + 1) % MAX;
      geo.attributes.position.needsUpdate = true;
    },

    update(dt) {
      for (let i = 0; i < MAX; i++) {
        if (ages[i] >= LIFETIME) {
          alphas[i] = 0;
          continue;
        }
        ages[i] += dt;
        positions[i * 3 + 0] += vels[i * 3 + 0] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
        const k = 1 - ages[i] / LIFETIME;
        alphas[i] = k * k * 0.9;
        sizes[i] += dt * 6;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
    },

    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
      if (mat.uniforms.tex.value) mat.uniforms.tex.value.dispose();
    },
  };
}
// =========================================================
// CLOUD LAYER — horizontal cloud plane the rocket flies through
// =========================================================
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 1024);

  // Big soft noise blobs — clouds
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 30 + Math.random() * 180;
    const a = 0.08 + Math.random() * 0.25;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,   `rgba(255, 255, 255, ${a})`);
    g.addColorStop(0.5, `rgba(240, 240, 250, ${a * 0.4})`);
    g.addColorStop(1,   'rgba(240, 240, 250, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Denser cores
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 20 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function createCloudLayer(scene, altitudeY) {
  const tex = makeCloudTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(4000, 4000);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = altitudeY;
  mesh.renderOrder = 5;
  mesh.visible = false;
  scene.add(mesh);

  let baseOpacity = 0;

  return {
    mesh,
    setOpacity(v) {
      baseOpacity = v;
      mat.opacity = v;
      mesh.visible = v > 0.01;
    },
    get opacity() { return baseOpacity; },
    spin(dt) {
      // slight rotation to sell motion
      mesh.rotation.y += dt * 0.008;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
// =========================================================
// STARFIELD — camera-locked star points for the black-sky shots
// =========================================================
export function createStarfield(scene, count = 600) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // random direction on a unit sphere
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = 700;
    positions[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i * 3 + 2] = Math.cos(phi) * r;
    sizes[i] = 0.8 + Math.random() * 2.2;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      globalAlpha: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      attribute float phase;
      uniform float time;
      varying float vSize;
      void main() {
        vSize = size;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (400.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float globalAlpha;
      uniform float time;
      varying float vSize;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float a = (1.0 - r * 2.0);
        a = pow(a, 1.5);
        gl_FragColor = vec4(1.0, 0.98, 0.92, a * globalAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  return {
    mesh: points,
    setAlpha(v) { mat.uniforms.globalAlpha.value = v; },
    update(camPos, t) {
      points.position.copy(camPos);
      mat.uniforms.time.value = t;
    },
    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    },
  };
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
export function setFlameOpacity(rocketGroup, opacity) {
  const a = Math.max(0, Math.min(1, opacity));
  rocketGroup.traverse(obj => {
    if (obj.userData && obj.userData.flame) {
      const flame = obj.userData.flame;
      const meshes = flame.userData.meshes || [];
      for (const m of meshes) {
        if (m.mesh && m.mesh.material) {
          m.mesh.material.opacity = m.baseOpacity * a;
        }
      }
      if (flame.userData.glow && flame.userData.glow.material) {
        flame.userData.glow.material.opacity = (flame.userData.baseGlowOpacity || 0.35) * a;
      }
      if (flame.userData.light) {
        flame.userData.light.intensity = (flame.userData.baseLightIntensity || 2) * a;
      }
    }
  });
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
// IGNITION FLASH
// =========================================================
export function spawnIgnitionFlash(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), coreMat);
  group.add(core);

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffaa55,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 16), haloMat);
  group.add(halo);

  const light = new THREE.PointLight(0xffddaa, 25, 60);
  group.add(light);

  const start = performance.now();
  const DURATION = 900;
  let animId = null;

  function loop() {
    const t = (performance.now() - start) / DURATION;
    if (t >= 1) {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      return;
    }
    core.scale.setScalar(1 + t * 3.5);
    coreMat.opacity = Math.max(0, 1 - t * 1.6);
    halo.scale.setScalar(1 + t * 5);
    haloMat.opacity = Math.max(0, 0.8 - t * 1.2);
    light.intensity = Math.max(0, 25 * (1 - t * 2.5));
    animId = requestAnimationFrame(loop);
  }
  animId = requestAnimationFrame(loop);

  return () => {
    if (animId) cancelAnimationFrame(animId);
    scene.remove(group);
  };
}

// =========================================================
// GROUND SMOKE
// =========================================================
export function spawnGroundSmoke(scene, position, intensity = 1.0) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const puffs = [];
  const PUFF_COUNT = 14;

  for (let i = 0; i < PUFF_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    const angle = (i / PUFF_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const speed = (3 + Math.random() * 3) * intensity;
    puff.userData = {
      velocity: new THREE.Vector3(
        Math.cos(angle) * speed,
        0.4 + Math.random() * 0.8,
        Math.sin(angle) * speed
      ),
      delay: i * 0.05,
    };
    group.add(puff);
    puffs.push(puff);
  }

  const start = performance.now();
  const DURATION = 3500;
  let animId = null;
  let lastT = start;

  function loop() {
    const now = performance.now();
    const t = (now - start) / DURATION;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (t >= 1) {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      return;
    }

    for (const puff of puffs) {
      const age = Math.max(0, t - puff.userData.delay);
      if (age <= 0) continue;
      puff.position.addScaledVector(puff.userData.velocity, dt);
      puff.userData.velocity.y -= 0.4 * dt;
      puff.userData.velocity.multiplyScalar(0.985);
      const size = 1 + age * 6;
      puff.scale.setScalar(size);
      const op = age < 0.15
        ? (age / 0.15) * 0.65
        : Math.max(0, 0.65 * (1 - (age - 0.15) / 0.7));
      puff.material.opacity = op;
    }

    animId = requestAnimationFrame(loop);
  }
  animId = requestAnimationFrame(loop);

  return () => {
    if (animId) cancelAnimationFrame(animId);
    scene.remove(group);
  };
}

// =========================================================
// CLAMP SPARKS
// =========================================================
export function spawnClampSparks(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const sparks = [];
  for (let i = 0; i < 20; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0xffdd66 : 0xff8833,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat);
    const angle = Math.random() * Math.PI * 2;
    const up = 1 + Math.random() * 4;
    const out = 2 + Math.random() * 5;
    spark.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * out,
      up,
      Math.sin(angle) * out
    );
    group.add(spark);
    sparks.push(spark);
  }

  const start = performance.now();
  const DURATION = 1200;
  let animId = null;
  let lastT = start;

  function loop() {
    const now = performance.now();
    const t = (now - start) / DURATION;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (t >= 1) {
      scene.remove(group);
      group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      return;
    }

    for (const s of sparks) {
      s.position.addScaledVector(s.userData.velocity, dt);
      s.userData.velocity.y -= 9.8 * dt;
      s.material.opacity = Math.max(0, 1 - t * 1.5);
    }

    animId = requestAnimationFrame(loop);
  }
  animId = requestAnimationFrame(loop);

  return () => {
    if (animId) cancelAnimationFrame(animId);
    scene.remove(group);
  };
}

// =========================================================
// COLLAPSE
// =========================================================
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

  for (const p of placeholders) {
    if (p.parent) p.parent.remove(p);
    p.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }

  if (pieces.length === 0) return;

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
// LAUNCH SEQUENCE (Test Fire — hover and land)
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
  camera,
  controls,
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

  const cameraBasePos = camera ? camera.position.clone() : null;
  const cameraBaseTarget = controls ? controls.target.clone() : null;

  function applyCameraShake(intensity) {
    if (!camera || !cameraBasePos) return;
    const t = performance.now() * 0.05;
    camera.position.x = cameraBasePos.x + Math.sin(t * 1.7) * intensity;
    camera.position.y = cameraBasePos.y + Math.cos(t * 2.3) * intensity;
    camera.position.z = cameraBasePos.z + Math.sin(t * 3.1) * intensity;
  }

  function restoreCamera() {
    if (camera && cameraBasePos) camera.position.copy(cameraBasePos);
    if (controls && cameraBaseTarget) controls.target.copy(cameraBaseTarget);
  }

  function followRocket(strength) {
    if (!camera || !controls) return;
    const targetY = rocketGroup.position.y + totalHeight * 0.4;
    controls.target.y += (targetY - controls.target.y) * strength;
  }

  let clampSparksFired = false;
  let ignitionFlashRef = null;
  let groundSmokeRef = null;
  let explosionSpawned = false;
  let explosionRef = null;
  let collapseTriggered = false;

  const startTime = performance.now();

  const loop = () => {
    const elapsed = performance.now() - startTime;

    if (mode === 'inert') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
        if (!clampSparksFired) {
          clampSparksFired = true;
          const pos = new THREE.Vector3();
          rocketGroup.getWorldPosition(pos);
          spawnClampSparks(scene, pos);
        }
      } else if (elapsed < 1800) {
        retractClamps(supportGroup, 1);
        onPhase('silent');
      } else if (!collapseTriggered) {
        collapseTriggered = true;
        collapseRocket(rocketGroup, supportGroup, scene);
        onPhase('collapsed');
      } else if (elapsed > 5200) {
        rocketGroup.visible = true;
        restoreCamera();
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    if (mode === 'dry') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
        if (!clampSparksFired) {
          clampSparksFired = true;
          const pos = new THREE.Vector3();
          rocketGroup.getWorldPosition(pos);
          spawnClampSparks(scene, pos);
        }
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
        restoreCamera();
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    if (mode === 'rip') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
        if (!clampSparksFired) {
          clampSparksFired = true;
          const pos = new THREE.Vector3();
          rocketGroup.getWorldPosition(pos);
          spawnClampSparks(scene, pos);
        }
      } else if (elapsed < 1400) {
        retractClamps(supportGroup, 1);
        if (camera) applyCameraShake(0.15);
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
        if (camera) applyCameraShake(0.5);
        rocketGroup.visible = false;
        hideAllFlames(rocketGroup);
        onPhase('exploded');
      } else if (elapsed > 4200) {
        if (explosionRef) explosionRef();
        rocketGroup.visible = true;
        rocketGroup.position.set(0, 0, 0);
        rocketGroup.rotation.set(0, 0, 0);
        resetClamps(supportGroup);
        restoreCamera();
        onComplete(false, { quality: 0, twr, peakHeight: 0, landClean: false, reason });
        activeLaunchId = null;
        return;
      }
      activeLaunchId = requestAnimationFrame(loop);
      return;
    }

    if (mode === 'stuck') {
      if (elapsed < CLAMP_MS) {
        retractClamps(supportGroup, elapsed / CLAMP_MS);
        onPhase('clamps');
        if (!clampSparksFired) {
          clampSparksFired = true;
          const pos = new THREE.Vector3();
          rocketGroup.getWorldPosition(pos);
          spawnClampSparks(scene, pos);
        }
      } else if (elapsed < 2600) {
        retractClamps(supportGroup, 1);
        const flames = showAllFlames(rocketGroup);
        for (const f of flames) {
          const flick = 0.9 + Math.random() * 0.2;
          f.scale.set(flick, flick, flick);
        }
        rocketGroup.position.x = Math.sin(elapsed * 0.1) * 0.1;
        rocketGroup.position.z = Math.cos(elapsed * 0.12) * 0.1;
        if (camera) applyCameraShake(0.08);
        onPhase('straining');
      } else if (!collapseTriggered) {
        hideAllFlames(rocketGroup);
        collapseTriggered = true;
        collapseRocket(rocketGroup, supportGroup, scene);
        onPhase('collapsed');
      } else if (elapsed > 7000) {
        rocketGroup.visible = true;
        restoreCamera();
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
      if (!clampSparksFired) {
        clampSparksFired = true;
        const pos = new THREE.Vector3();
        rocketGroup.getWorldPosition(pos);
        spawnClampSparks(scene, pos);
      }
    } else if (elapsed < CLAMP_MS + 4000) {
      retractClamps(supportGroup, 1);
      const p = (elapsed - CLAMP_MS) / 4000;

      if (!ignitionFlashRef) {
        const pos = new THREE.Vector3();
        rocketGroup.getWorldPosition(pos);
        ignitionFlashRef = spawnIgnitionFlash(scene, pos);
      }
      if (!groundSmokeRef) {
        const pos = new THREE.Vector3();
        rocketGroup.getWorldPosition(pos);
        pos.y = 0.5;
        groundSmokeRef = spawnGroundSmoke(scene, pos, 1.2);
      }

      followRocket(0.08);
      const shake = Math.max(0, 0.35 * (1 - p * 1.5));
      if (shake > 0.01) applyCameraShake(shake);

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
      followRocket(0.05);
      const flames = showAllFlames(rocketGroup);
      for (const f of flames) {
        const flick = 0.85 + Math.random() * 0.3;
        f.scale.set(flick, flick * 0.95, flick);
      }
      rocketGroup.position.set(driftAmount * driftDirX, peakHeight, driftAmount * driftDirZ);
      onPhase('hover');
    } else if (elapsed < CLAMP_MS + 4600 + 4000) {
      const p = (elapsed - CLAMP_MS - 4600) / 4000;
      followRocket(0.05);
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
      restoreCamera();
      onComplete(true, { quality: 1, twr, peakHeight, landClean: true, reason: 'Clean flight.' });
      activeLaunchId = null;
      return;
    }

    activeLaunchId = requestAnimationFrame(loop);
  };

  activeLaunchId = requestAnimationFrame(loop);
}

// =========================================================
// MISSION ASCENT
// Full launch with multi-camera direction and Earth backdrop.
// Used by Launch Mission. Test Fire uses playLaunchSequence.
// =========================================================
export function playAscentSequence({
  rocketGroup,
  supportGroup,
  scene,
  camera,
  controls,
  template,
  installed,
  onPhase = () => {},
  onComplete = () => {},
}) {
  abortLaunch();

  const bySlot = {};
  for (const p of installed) bySlot[p.slot] = p;
  const has = slot => !!bySlot[slot];

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

  if (!hasEngine || !hasFuel || !hasOx || !hasThrust || twr < 1.0) {
    return playLaunchSequence({
      rocketGroup, supportGroup, scene, camera, controls,
      template, installed, onPhase, onComplete,
    });
  }

  const segments = rocketGroup.userData.segments || [];
  const S = rocketGroup.userData.totalHeight || 10;
  const baseSeg = segments[0];
  if (!baseSeg) return;

  let separationSeg = null;
  for (const seg of segments) {
    if (seg.userData.slot === 'separation') { separationSeg = seg; break; }
  }

  // ---------- snapshot ----------
  const camStart = camera.position.clone();
  const targetStart = controls.target.clone();
  const fovStart = camera.fov;
  const controlsWasEnabled = controls.enabled;
  controls.enabled = false;

  // ---------- sky ----------
  let skyUniforms = null;
  let skyMesh = null;
  scene.traverse(o => {
    if (o.userData && o.userData.uniforms && o.userData.uniforms.topColor) {
      skyUniforms = o.userData.uniforms;
      skyMesh = o;
    }
  });
  const skyStart = skyUniforms ? {
    top:     skyUniforms.topColor.value.clone(),
    mid:     skyUniforms.midColor.value.clone(),
    horizon: skyUniforms.horizonColor.value.clone(),
    ground:  skyUniforms.groundColor.value.clone(),
  } : null;
  const skySpace = {
    top:     new THREE.Color(0x000000),
    mid:     new THREE.Color(0x000205),
    horizon: new THREE.Color(0x2a6a9a),
    ground:  new THREE.Color(0x0a1e2c),
  };

  // ---------- ground meshes ----------
  const groundMeshes = [];
  scene.traverse(o => {
    if (!o.isMesh && !o.isPoints) return;
    if (o === rocketGroup) return;
    let p = o.parent;
    let inRocket = false;
    while (p) { if (p === rocketGroup) { inRocket = true; break; } p = p.parent; }
    if (inRocket) return;
    if (o.material && o.material.uniforms) return;
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    if (Math.abs(wp.y) < 200) {
      groundMeshes.push({ mesh: o, origVisible: o.visible, origOpacity: o.material?.opacity });
    }
  });

  // ---------- fade overlay ----------
  const fadeEl = document.createElement('div');
  fadeEl.className = 'ascent-fade';
  document.body.appendChild(fadeEl);

  // ---------- contrail + clouds + stars ----------
  const contrail = createContrail(scene, 500);
  const cloudLayer = createCloudLayer(scene, S * 4.5);
  const starfield = createStarfield(scene, 700);

  // ---------- staging ----------
  let stage1Group = null;
  const stage1Vel = new THREE.Vector3();
  const stage1Spin = new THREE.Vector3();
  let staged = false;

  // ---------- reset ----------
  resetClamps(supportGroup);
  hideAllFlames(rocketGroup);
  setFlameOpacity(rocketGroup, 1);
  rocketGroup.position.set(0, 0, 0);
  rocketGroup.rotation.set(0, 0, 0);
  rocketGroup.visible = true;

  // =========================================================
  // TIMELINE — 24s, slow enough to watch
  // =========================================================
  const T = {
    padEnd:      1.5,
    engineEnd:   3.5,
    liftEnd:     5.5,
    groundEnd:   8.5,
    sideEnd:    12.0,
    midEnd:     15.5,
    upperEnd:   19.0,
    spaceEnd:   21.5,
    fadeEnd:    24.0,
  };
  const DURATION = T.fadeEnd;

  // =========================================================
  // ALTITUDE KEYFRAMES (units = S)
  // =========================================================
  const KEY = [
    { t: 0.0,  y: 0.0 },
    { t: 3.5,  y: 0.0 },
    { t: 5.5,  y: 0.6 },
    { t: 8.5,  y: 1.8 },
    { t: 12.0, y: 3.5 },
    { t: 15.5, y: 6.0 },
    { t: 19.0, y: 9.5 },
    { t: 21.5, y: 13.0 },
    { t: 24.0, y: 15.5 },
  ];

  function altitudeAt(t) {
    if (t <= KEY[0].t) return 0;
    for (let i = 0; i < KEY.length - 1; i++) {
      const a = KEY[i];
      const b = KEY[i + 1];
      if (t >= a.t && t <= b.t) {
        const p = (t - a.t) / (b.t - a.t);
        const e = p * p * (3 - 2 * p);
        return S * (a.y + (b.y - a.y) * e);
      }
    }
    return S * KEY[KEY.length - 1].y;
  }

  // =========================================================
  // CAMERA SHOTS
  //
  // `zoom` grows from 1.0 to 1.9 across the flight so the
  // camera pulls back as the rocket climbs — the rocket
  // appears to recede into the distance, then stays framed
  // because distance growth outpaces visual shrinkage.
  // =========================================================
  function shotFor(t, ry) {
    // zoom factor: 1.0 at t=0 → 1.9 at t=T.upperEnd
    const zoomRaw = Math.max(0, Math.min(1, (t - T.engineEnd) / (T.upperEnd - T.engineEnd)));
    const zoom = 1.0 + zoomRaw * 0.9;

    // P1 — pad wide (0–1.5s)
    if (t < T.padEnd) {
      return {
        pos:  new THREE.Vector3(S * 3.6, ry + S * 1.2, S * 4.5),
        look: new THREE.Vector3(0, ry + S * 0.45, 0),
        fov:  40,
      };
    }
    // P2 — base tight (1.5–3.5s)
    if (t < T.engineEnd) {
      return {
        pos:  new THREE.Vector3(S * 2.6, ry + S * 1.0, S * 3.1),
        look: new THREE.Vector3(0, ry + S * 0.42, 0),
        fov:  44,
      };
    }
    // P3 — low, looking up (3.5–8.5s)
    if (t < T.groundEnd) {
      return {
        pos:  new THREE.Vector3(S * 3.4 * zoom, ry + S * 0.5, S * 4.0 * zoom),
        look: new THREE.Vector3(0, ry + S * 0.55, 0),
        fov:  42,
      };
    }
    // P4 — side follow (8.5–12.0s)
    if (t < T.sideEnd) {
      return {
        pos:  new THREE.Vector3(S * 3.6 * zoom, ry + S * 0.6 * zoom, S * 4.2 * zoom),
        look: new THREE.Vector3(0, ry + S * 0.45, 0),
        fov:  40,
      };
    }
    // P5 — high 3/4 (12.0–15.5s)
    if (t < T.midEnd) {
      return {
        pos:  new THREE.Vector3(S * 4.4 * zoom, ry + S * 1.2 * zoom, S * 5.0 * zoom),
        look: new THREE.Vector3(0, ry + S * 0.35, 0),
        fov:  38,
      };
    }
    // P6 — wide (15.5–19.0s)
    if (t < T.upperEnd) {
      return {
        pos:  new THREE.Vector3(S * 5.5 * zoom, ry + S * 1.1 * zoom, S * 6.3 * zoom),
        look: new THREE.Vector3(0, ry + S * 0.30, 0),
        fov:  36,
      };
    }
    // P7 — space (19.0–24.0s)
    return {
      pos:  new THREE.Vector3(S * 7.5 * zoom, ry + S * 1.0 * zoom, S * 8.5 * zoom),
      look: new THREE.Vector3(0, ry + S * 0.25, 0),
      fov:  34,
    };
  }

  const start = performance.now();
  let last = start;
  let lastPhase = '';
  let contrailTimer = 0;

  const setPhase = (name) => {
    if (name === lastPhase) return;
    lastPhase = name;
    onPhase(name);
  };

  const cleanup = () => {
    if (skyUniforms && skyStart) {
      skyUniforms.topColor.value.copy(skyStart.top);
      skyUniforms.midColor.value.copy(skyStart.mid);
      skyUniforms.horizonColor.value.copy(skyStart.horizon);
      skyUniforms.groundColor.value.copy(skyStart.ground);
    }
    if (skyMesh) skyMesh.position.set(0, 0, 0);

    for (const gm of groundMeshes) {
      gm.mesh.visible = gm.origVisible;
      if (gm.mesh.material && gm.origOpacity !== undefined) {
        gm.mesh.material.opacity = gm.origOpacity;
      }
    }

    camera.fov = fovStart;
    camera.updateProjectionMatrix();
    camera.position.copy(camStart);
    controls.target.copy(targetStart);
    controls.enabled = controlsWasEnabled;
    controls.update();

    if (stage1Group && stage1Group.parent) {
      stage1Group.parent.remove(stage1Group);
      stage1Group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      stage1Group = null;
    }

    contrail.dispose();
    cloudLayer.dispose();
    starfield.dispose();

    if (fadeEl && fadeEl.parentNode) fadeEl.parentNode.removeChild(fadeEl);
  };

  const loop = () => {
    const now = performance.now();
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const ry = altitudeAt(t);
    rocketGroup.position.y = ry;

    retractClamps(supportGroup, t < T.padEnd ? t / T.padEnd : 1);

    // ---------- flames + plume expansion ----------
    if (t > T.padEnd - 0.2) {
      const fade = Math.min(1, (t - (T.padEnd - 0.2)) / 0.6);
      setFlameOpacity(rocketGroup, fade);

      // wider plume at altitude (vacuum expansion)
      const altFactor = Math.min(1, ry / (S * 5));
      const plumeScale = 1 + altFactor * 0.8;

      const flames = showAllFlames(rocketGroup, fade);
      for (const f of flames) {
        const flick = 0.9 + Math.random() * 0.15;
        f.scale.set(flick * plumeScale, flick * (0.9 + altFactor * 0.7), flick * plumeScale);
      }
    }

    // ---------- contrail spawn ----------
    if (t > T.padEnd + 0.4 && ry > 0) {
      contrailTimer += dt;
      const interval = 0.018;
      while (contrailTimer > interval) {
        contrailTimer -= interval;
        // spawn at rocket base
        const baseY = ry + Math.random() * 0.5;
        contrail.spawn(
          (Math.random() - 0.5) * S * 0.1,
          baseY,
          (Math.random() - 0.5) * S * 0.1,
          (Math.random() - 0.5) * 0.4,
          -0.4 - Math.random() * 0.5,
          (Math.random() - 0.5) * 0.4,
          1.5 + Math.random() * 1.5
        );
      }
    }
    contrail.update(dt);

    // ---------- staging ----------
    if (!staged && t >= T.sideEnd - 0.4 && separationSeg && separationSeg.userData.nextParent) {
      staged = true;
      setPhase('staging');

      const stage2Root = separationSeg.userData.nextParent;
      rocketGroup.attach(stage2Root);

      stage1Group = new THREE.Group();
      stage1Group.position.copy(rocketGroup.position);
      scene.add(stage1Group);
      stage1Group.attach(baseSeg);

      stage1Vel.set(
        (Math.random() - 0.5) * 1.0,
        -S * 0.25,
        (Math.random() - 0.5) * 1.0
      );
      stage1Spin.set(
        (Math.random() - 0.5) * 1.0,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.0
      );

      stage1Group.traverse(o => {
        if (o.userData && o.userData.flame) o.userData.flame.visible = false;
      });
    }

    if (stage1Group) {
      stage1Group.position.addScaledVector(stage1Vel, dt);
      stage1Group.rotation.x += stage1Spin.x * dt;
      stage1Group.rotation.y += stage1Spin.y * dt;
      stage1Group.rotation.z += stage1Spin.z * dt;
    }

    // ---------- sky tween ----------
    if (skyUniforms && skyStart) {
      const raw = Math.max(0, Math.min(1, (t - T.padEnd) / (T.upperEnd - T.padEnd)));
      const k = raw * raw * (3 - 2 * raw);
      skyUniforms.topColor.value.lerpColors(skyStart.top, skySpace.top, k);
      skyUniforms.midColor.value.lerpColors(skyStart.mid, skySpace.mid, k);
      skyUniforms.horizonColor.value.lerpColors(skyStart.horizon, skySpace.horizon, k);
      skyUniforms.groundColor.value.lerpColors(skyStart.ground, skySpace.ground, k);
    }

    if (skyMesh) skyMesh.position.copy(camera.position);

    // ---------- cloud layer opacity ----------
    // Fades in from t=6, peaks when rocket is at cloud altitude,
    // fades out after.
    {
      const cloudAlt = S * 4.5;
      const rocketAtCloud = ry / cloudAlt; // 0..1+
      // use a hump: transparent far below, opaque near, transparent above
      const near = Math.max(0, 1 - Math.abs(rocketAtCloud - 1) * 2.2);
      const k = Math.pow(near, 1.5) * 0.85;
      cloudLayer.setOpacity(k);
      cloudLayer.spin(dt);
    }

    // ---------- starfield ----------
    {
      const starRaw = Math.max(0, Math.min(1, (t - T.sideEnd) / (T.midEnd - T.sideEnd)));
      starfield.setAlpha(starRaw * 0.85);
      starfield.update(camera.position, t);
    }

    // ---------- ground fade ----------
    const groundFade = Math.max(0, Math.min(1, (t - T.groundEnd) / (T.midEnd - T.groundEnd)));
    const groundVisible = groundFade < 0.9;
    for (const gm of groundMeshes) {
      if (groundVisible) {
        gm.mesh.visible = gm.origVisible;
        if (gm.mesh.material && gm.origOpacity !== undefined) {
          gm.mesh.material.opacity = gm.origOpacity * (1 - groundFade);
          gm.mesh.material.transparent = true;
        }
      } else {
        gm.mesh.visible = false;
      }
    }

    // ---------- camera ----------
    const shot = shotFor(t, ry);
    camera.position.copy(shot.pos);
    controls.target.copy(shot.look);
    controls.update();
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }

    // ---------- phases ----------
    if (t < T.padEnd)          setPhase('clamps');
    else if (t < T.engineEnd)  setPhase('ignition');
    else if (t < T.groundEnd)  setPhase('liftoff');
    else if (t < T.sideEnd)    setPhase('maxq');
    else if (t < T.midEnd)     setPhase('engine');
    else if (t < T.upperEnd)   setPhase('upper');
    else                        setPhase('coast');

    // ---------- fade ----------
    if (t > T.spaceEnd - 1.5) {
      const p = Math.max(0, Math.min(1, (t - (T.spaceEnd - 1.5)) / 1.5));
      fadeEl.style.opacity = String(p);
    }

    if (t >= DURATION) {
      cleanup();
      onComplete(true, { quality: 1, twr, reason: 'Reached orbit.' });
      activeLaunchId = null;
      return;
    }

    activeLaunchId = requestAnimationFrame(loop);
  };

  activeLaunchId = requestAnimationFrame(loop);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)  { return t * t * t; }