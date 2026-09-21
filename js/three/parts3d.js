import * as THREE from 'three';

// =========================================================
// PROCEDURAL TEXTURES — generated once, reused forever
// =========================================================
const TEX_CACHE = {};

function getMLITexture() {
  if (TEX_CACHE.mli) return TEX_CACHE.mli;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');

  // Base gold
  ctx.fillStyle = '#c99a3a';
  ctx.fillRect(0, 0, 512, 512);

  // Wrinkles — random arcs and lines
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 20 + Math.random() * 80;
    const ang = Math.random() * Math.PI * 2;
    ctx.strokeStyle = `rgba(${200 + Math.random() * 55}, ${150 + Math.random() * 60}, ${60 + Math.random() * 60}, ${0.15 + Math.random() * 0.3})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Bright reflections
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 10 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 240, 180, 0.4)');
    g.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.mli = tex;
  return tex;
}

function getCarbonTexture() {
  if (TEX_CACHE.carbon) return TEX_CACHE.carbon;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, 256, 256);

  const size = 16;
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 256; x += size) {
      const offset = (y / size) % 2 === 0 ? 0 : size / 2;
      const shade = ((x + y) / size) % 2 === 0 ? '#1e1e24' : '#181820';
      ctx.fillStyle = shade;
      ctx.fillRect(x + offset, y, size / 2 - 1, size - 1);

      // Highlight edge
      ctx.fillStyle = 'rgba(80, 80, 100, 0.15)';
      ctx.fillRect(x + offset, y, size / 2 - 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.carbon = tex;
  return tex;
}

function getPanelTexture() {
  if (TEX_CACHE.panel) return TEX_CACHE.panel;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');

  // Base aluminum
  ctx.fillStyle = '#a8a8b0';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle noise
  for (let i = 0; i < 8000; i++) {
    ctx.fillStyle = `rgba(${150 + Math.random() * 60}, ${150 + Math.random() * 60}, ${160 + Math.random() * 60}, 0.15)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }

  // Panel lines — grid
  ctx.strokeStyle = 'rgba(60, 60, 70, 0.75)';
  ctx.lineWidth = 1.5;
  for (let i = 64; i < 512; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
  }

  // Bolts at intersections
  for (let x = 64; x < 512; x += 64) {
    for (let y = 64; y < 512; y += 64) {
      ctx.fillStyle = '#505058';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8c8d0';
      ctx.beginPath();
      ctx.arc(x - 0.5, y - 0.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  TEX_CACHE.panel = tex;
  return tex;
}

// =========================================================
// MATERIALS
// =========================================================
const MATS = {
  metalLight:  new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9,  roughness: 0.24 }),
  metalMid:    new THREE.MeshStandardMaterial({ color: 0x909098, metalness: 0.92, roughness: 0.28 }),
  metalDark:   new THREE.MeshStandardMaterial({ color: 0x2a2a34, metalness: 0.94, roughness: 0.22 }),
  metalBlack:  new THREE.MeshStandardMaterial({ color: 0x141418, metalness: 0.95, roughness: 0.2 }),
  engineBell:  new THREE.MeshStandardMaterial({ color: 0x0e0e16, metalness: 0.95, roughness: 0.16, side: THREE.DoubleSide }),
  copper:      new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.95, roughness: 0.22 }),
  copperDark:  new THREE.MeshStandardMaterial({ color: 0x8a5522, metalness: 0.95, roughness: 0.28 }),
  gold:        new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.7,  roughness: 0.3 }),
  lox:         new THREE.MeshStandardMaterial({ color: 0x3fb5ff, metalness: 0.7,  roughness: 0.35 }),
  loxFrost:    new THREE.MeshStandardMaterial({ color: 0xd8ecf8, metalness: 0.55, roughness: 0.6, transparent: true, opacity: 0.45 }),
  methane:     new THREE.MeshStandardMaterial({ color: 0xa8d8f0, metalness: 0.72, roughness: 0.32 }),
  storable:    new THREE.MeshStandardMaterial({ color: 0xc0b09a, metalness: 0.78, roughness: 0.32 }),
  silver:      new THREE.MeshStandardMaterial({ color: 0xc8c8d4, metalness: 0.95, roughness: 0.12 }),
  solarFrame:  new THREE.MeshStandardMaterial({ color: 0x909098, metalness: 0.85, roughness: 0.28 }),
  panelBlue:   new THREE.MeshStandardMaterial({ color: 0x2472ff, metalness: 0.7,  roughness: 0.35 }),
  payload:     new THREE.MeshStandardMaterial({ color: 0xff5522, metalness: 0.65, roughness: 0.4 }),
  payloadHi:   new THREE.MeshStandardMaterial({ color: 0xff6633, metalness: 0.7,  roughness: 0.3 }),
  nose:        new THREE.MeshStandardMaterial({ color: 0xf0f0f4, metalness: 0.8,  roughness: 0.24 }),
  noseAblative: new THREE.MeshStandardMaterial({ color: 0x3a2a24, metalness: 0.15, roughness: 0.92 }),
  yellow:      new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.7,  roughness: 0.35 }),
  red:         new THREE.MeshStandardMaterial({ color: 0xd94435, metalness: 0.6,  roughness: 0.45 }),
  kapton:      new THREE.MeshStandardMaterial({ color: 0xffaa55, metalness: 0.85, roughness: 0.42, side: THREE.DoubleSide }),
  glass:       new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.95, roughness: 0.05, emissive: 0x112244, emissiveIntensity: 0.6 }),
  thermalPad:  new THREE.MeshStandardMaterial({ color: 0x101014, metalness: 0.2,  roughness: 0.95 }),
  // NEW materials for payload bus
  mli:         new THREE.MeshStandardMaterial({ map: getMLITexture(), color: 0xffffff, metalness: 0.85, roughness: 0.35 }),
  carbon:      new THREE.MeshStandardMaterial({ map: getCarbonTexture(), color: 0xffffff, metalness: 0.6, roughness: 0.4 }),
  panelAlum:   new THREE.MeshStandardMaterial({ map: getPanelTexture(), color: 0xffffff, metalness: 0.88, roughness: 0.28 }),
  // Camera glass
  lensGlass:   new THREE.MeshStandardMaterial({ color: 0x0a0a2a, metalness: 1.0, roughness: 0.02, emissive: 0x2244aa, emissiveIntensity: 0.5 }),
  lensFront:   new THREE.MeshStandardMaterial({ color: 0x4455aa, metalness: 1.0, roughness: 0.05, emissive: 0x4466ff, emissiveIntensity: 0.3 }),
  // Antenna dish
  dishWhite:   new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide }),
  dishGold:    new THREE.MeshStandardMaterial({ color: 0xffcc44, metalness: 0.9, roughness: 0.15, side: THREE.DoubleSide }),
};

function addMesh(group, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

function addTube(group, points, mat, radius = 0.03) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  const m = new THREE.Mesh(geo, mat);
  group.add(m);
  return m;
}

// =========================================================
// HARDWARE HELPERS
// =========================================================
function addBoltRing(group, count, radius, y, boltSize = 0.03, mat = MATS.metalDark) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(boltSize, boltSize * 0.85, boltSize * 1.2, 6),
      mat
    );
    bolt.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    group.add(bolt);
  }
}

function addPanelLine(group, x1, y1, x2, y2, z, mat = MATS.metalBlack, thickness = 0.008) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(len, thickness, thickness),
    mat
  );
  line.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
  line.rotation.z = Math.atan2(dy, dx);
  group.add(line);
}

function addWireBundle(group, points, mat = MATS.metalBlack, radius = 0.018) {
  return addTube(group, points, mat, radius);
}

// =========================================================
// ENGINE CLUSTER
// =========================================================
export function makeEngineCluster(h, d, variant = 'nine') {
  const g = new THREE.Group();
  const baseY = h / 2 - 0.06;

  addMesh(g, new THREE.CylinderGeometry(d / 2, d / 2, 0.12, 48), MATS.metalDark, 0, baseY, 0);
  addBoltRing(g, 24, d / 2 - 0.08, baseY - 0.06, 0.025);

  let count = 9, layout = 'octaweb';
  if (variant === 'one') { count = 1; layout = 'single'; }
  else if (variant === 'two') { count = 2; layout = 'ring'; }
  else if (variant === 'three') { count = 3; layout = 'ring'; }
  else if (variant === 'four') { count = 4; layout = 'ring'; }
  else if (variant === 'five') { count = 5; layout = 'ring'; }

  const positions = [];
  const rInner = d * 0.24;
  if (layout === 'single') positions.push([0, 0]);
  else if (layout === 'octaweb') {
    positions.push([0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      positions.push([Math.cos(a) * rInner, Math.sin(a) * rInner]);
    }
  } else {
    const r = count === 2 ? d * 0.18 : d * 0.22;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.PI / count;
      positions.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  const nozzleD = d * (count >= 9 ? 0.22 : count === 5 ? 0.28 : count === 4 ? 0.32 : count === 3 ? 0.36 : count === 2 ? 0.42 : 0.55);
  const throatR = nozzleD * 0.2;
  const exitR = nozzleD / 2;

  const chamberH = h * 0.18;
  const injectorH = h * 0.04;
  const bellTopY = baseY - chamberH - injectorH - 0.06;
  const bellBotY = -h / 2 + 0.06;
  const bellHeight = Math.max(0.3, bellTopY - bellBotY);
  const bellCenterY = (bellTopY + bellBotY) / 2;

  for (const [nx, nz] of positions) {
    addMesh(g, new THREE.CylinderGeometry(nozzleD * 0.42, nozzleD * 0.32, injectorH, 24),
      MATS.copper, nx, baseY - 0.12 - injectorH / 2, nz);
    addMesh(g, new THREE.CylinderGeometry(nozzleD * 0.32, throatR, chamberH, 24),
      MATS.metalMid, nx, baseY - 0.12 - injectorH - chamberH / 2, nz);

    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(throatR, exitR, bellHeight, 32, 1, true), MATS.engineBell);
    bell.position.set(nx, bellCenterY, nz);
    bell.userData.isNozzle = true;
    bell.userData.exitR = exitR;
    bell.userData.bellHeight = bellHeight;
    g.add(bell);

    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const y = bellTopY - bellHeight * t;
      const r = throatR + (exitR - throatR) * t;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.005, 0.008, 6, 32), MATS.copperDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(nx, y, nz);
      g.add(ring);
    }

    const lip = new THREE.Mesh(new THREE.TorusGeometry(exitR, 0.012, 8, 32), MATS.copper);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(nx, bellBotY, nz);
    g.add(lip);

    addMesh(g, new THREE.CylinderGeometry(nozzleD * 0.14, nozzleD * 0.14, h * 0.11, 14),
      MATS.metalMid, nx + nozzleD * 0.5, baseY - 0.15, nz);

    addTube(g, [
      new THREE.Vector3(nx + nozzleD * 0.5, baseY - 0.15, nz),
      new THREE.Vector3(nx + nozzleD * 0.4, baseY - 0.12, nz + 0.05),
      new THREE.Vector3(nx + nozzleD * 0.1, baseY - 0.14, nz + 0.05),
      new THREE.Vector3(nx, baseY - 0.13, nz),
    ], MATS.copperDark, 0.015);

    const gimbal = new THREE.Mesh(new THREE.TorusGeometry(nozzleD * 0.42, 0.02, 8, 24), MATS.silver);
    gimbal.rotation.x = Math.PI / 2;
    gimbal.position.set(nx, baseY - 0.12 - injectorH - chamberH - 0.02, nz);
    g.add(gimbal);

    const flame = makeFlameGroup(exitR, bellHeight);
    flame.position.set(nx, bellBotY, nz);
    bell.userData.flame = flame;
    g.add(flame);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2 - 0.03, 0.05, 10, 48), MATS.metalMid);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = baseY - 0.12;
  g.add(ring);

  return g;
}

// =========================================================
// THRUST STRUCTURE
// =========================================================
export function makeThrustStructure(h, d) {
  const g = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(d / 2, d / 2, h, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6e6e7c, metalness: 0.85, roughness: 0.35, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  g.add(shell);

  for (const y of [-h / 2 + 0.05, h / 2 - 0.05]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.06, 10, 48), MATS.metalMid);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
  }

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const dir = i % 2 === 0 ? 1 : -1;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h * 1.05, 8), MATS.metalDark);
    strut.position.set(Math.cos(a) * (d / 2 - 0.12), 0, Math.sin(a) * (d / 2 - 0.12));
    strut.rotation.z = dir * 0.28;
    strut.rotation.y = -a;
    g.add(strut);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h * 0.95, 8), MATS.metalMid);
    strut.position.set(Math.cos(a) * (d / 2 - 0.05), 0, Math.sin(a) * (d / 2 - 0.05));
    g.add(strut);
  }

  const shield = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 - 0.15, d / 2 - 0.15, 0.03, 48), MATS.thermalPad);
  shield.position.y = -h / 2 + 0.1;
  g.add(shield);

  return g;
}

// =========================================================
// TANK
// =========================================================
export function makeTank(h, d, colorMat = MATS.metalLight, kind = 'standard') {
  const g = new THREE.Group();
  const domeH = d * 0.24;
  const bodyH = h - domeH * 2;
  const bodyR = d / 2;

  addMesh(g, new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 64), colorMat, 0, 0);

  const domeGeo = new THREE.SphereGeometry(bodyR, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  addMesh(g, domeGeo, colorMat, 0, bodyH / 2, 0);
  const botDome = addMesh(g, domeGeo, colorMat, 0, -bodyH / 2, 0);
  botDome.rotation.x = Math.PI;

  const weldCount = Math.max(4, Math.floor(bodyH / 1.0));
  for (let i = 0; i <= weldCount; i++) {
    const y = -bodyH / 2 + (i / weldCount) * bodyH;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(bodyR + 0.005, 0.012, 6, 64), MATS.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }

  for (const y of [bodyH / 2, -bodyH / 2]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(bodyR + 0.005, 0.014, 6, 64), MATS.metalDark);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, bodyH * 0.96, 0.03), MATS.metalDark);
    strip.position.set(Math.cos(a) * (bodyR + 0.01), 0, Math.sin(a) * (bodyR + 0.01));
    strip.rotation.y = -a;
    g.add(strip);
  }

  if (kind === 'cryo' || kind === 'lox' || kind === 'methane') {
    const frostGeo = new THREE.CylinderGeometry(bodyR + 0.02, bodyR + 0.02, bodyH * 0.7, 64, 1, true);
    g.add(new THREE.Mesh(frostGeo, MATS.loxFrost));
  }

  addMesh(g, new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16), MATS.copper, 0, bodyH / 2 + domeH * 0.7, 0);
  const prvPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 10), MATS.copperDark);
  prvPipe.rotation.z = Math.PI / 2;
  prvPipe.position.set(bodyR * 0.4, bodyH / 2 + domeH * 0.7, 0);
  g.add(prvPipe);

  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16), MATS.silver);
  port.rotation.z = Math.PI / 2;
  port.position.set(bodyR + 0.05, -bodyH / 2 + 0.2, 0);
  g.add(port);

  addMesh(g, new THREE.BoxGeometry(0.12, 0.16, 0.1), MATS.metalBlack, 0, -bodyH / 2 + 0.3, bodyR + 0.05);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.08), MATS.metalMid);
    b.position.set(Math.cos(a) * (bodyR + 0.05), -bodyH / 2 - domeH + 0.1, Math.sin(a) * (bodyR + 0.05));
    b.rotation.y = -a;
    g.add(b);
  }

  addTube(g, [
    new THREE.Vector3(bodyR + 0.09, -bodyH / 2 + 0.2, 0.15),
    new THREE.Vector3(bodyR + 0.11, 0, 0.15),
    new THREE.Vector3(bodyR + 0.09, bodyH / 2 + 0.1, 0.15),
  ], MATS.copperDark, 0.022);

  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 24), MATS.silver);
  hatch.position.set(bodyR * 0.4, bodyH / 2 + domeH * 0.6, 0);
  g.add(hatch);

  return g;
}

// =========================================================
// INTERTANK / PRESSURANT / GRID FINS / INTERSTAGE / SEPARATION / UPPER ENGINE (unchanged)
// =========================================================
export function makeIntertank(h, d) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(d / 2, d / 2, h, 48, 1, true), MATS.metalMid);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.96, 0.06), MATS.metalDark);
    m.position.set(Math.cos(a) * (d / 2), 0, Math.sin(a) * (d / 2));
    m.rotation.y = -a;
    g.add(m);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.03), MATS.metalBlack);
    panel.position.set(Math.cos(a) * (d / 2 + 0.02), 0, Math.sin(a) * (d / 2 + 0.02));
    panel.rotation.y = -a;
    g.add(panel);
  }
  for (const y of [-h / 2 + 0.1, h / 2 - 0.1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2 + 0.01, 0.03, 8, 48), MATS.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  return g;
}

export function makePressurant(h, d, variant = 'standard') {
  const g = new THREE.Group();
  if (variant === 'autogenous' || variant === 'regenerative') {
    addMesh(g, new THREE.BoxGeometry(d * 0.6, h * 0.9, d * 0.5), MATS.copper);
    addMesh(g, new THREE.TorusGeometry(d * 0.25, 0.05, 8, 24), MATS.copperDark, d * 0.35, 0, 0);
    addTube(g, [
      new THREE.Vector3(-d * 0.3, 0, 0),
      new THREE.Vector3(-d * 0.4, h * 0.3, 0),
      new THREE.Vector3(0, h * 0.4, 0),
    ], MATS.copperDark, 0.02);
    return g;
  }
  if (variant === 'nitrogen') {
    const sphereR = d * 0.26;
    for (const x of [-d * 0.28, d * 0.28]) {
      addMesh(g, new THREE.SphereGeometry(sphereR, 24, 16), MATS.metalLight, x, 0, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(sphereR * 1.02, 0.02, 6, 24), MATS.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0, 0);
      g.add(ring);
    }
    return g;
  }
  const sphereR = d * 0.22;
  for (const [x, y, z] of [[0, 0, 0], [d * 0.3, 0, 0], [-d * 0.3, 0, 0]]) {
    addMesh(g, new THREE.SphereGeometry(sphereR, 24, 16), MATS.kapton, x, y, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(sphereR * 1.02, 0.02, 6, 24), MATS.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    g.add(ring);
  }
  return g;
}

export function makeGridFins(h, d) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Group();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.85, 0.04), MATS.metalDark);
        bar.position.set((c - 2) * 0.12, 0, (r - 2) * 0.12);
        fin.add(bar);
      }
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, h * 0.9, 0.03), MATS.metalMid);
    frame.position.z = -0.28;
    fin.add(frame);
    const frame2 = frame.clone();
    frame2.position.z = 0.28;
    fin.add(frame2);
    fin.position.set(Math.cos(a) * d / 2, 0, Math.sin(a) * d / 2);
    fin.rotation.y = -a;
    g.add(fin);
  }
  return g;
}

export function makeInterstage(h, d) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(d / 2, d / 2, h, 48, 1, true), MATS.metalLight);
  for (const y of [h / 2 - 0.12, -h / 2 + 0.12]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(d / 2 + 0.02, 0.03, 8, 48), MATS.metalDark);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 8), MATS.metalBlack);
    vent.rotation.z = Math.PI / 2;
    vent.position.set(Math.cos(a) * (d / 2 + 0.03), h / 2 - 0.2, Math.sin(a) * (d / 2 + 0.03));
    vent.rotation.y = -a;
    g.add(vent);
  }
  return g;
}

export function makeSeparation(h, d) {
  const g = new THREE.Group();
  const ring = addMesh(g, new THREE.TorusGeometry(d / 2, 0.07, 10, 48), MATS.yellow);
  ring.rotation.x = Math.PI / 2;
  addBoltRing(g, 16, d / 2 + 0.04, 0, 0.035);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.03), MATS.red);
    stripe.position.set(Math.cos(a) * (d / 2 + 0.03), h / 2, Math.sin(a) * (d / 2 + 0.03));
    stripe.rotation.y = -a;
    g.add(stripe);
  }
  return g;
}

export function makeUpperEngine(h, d) {
  const g = new THREE.Group();
  const throatR = d * 0.12;
  const exitR = d / 2;
  addMesh(g, new THREE.CylinderGeometry(d * 0.28, d * 0.24, h * 0.06, 24), MATS.copper, 0, h * 0.48, 0);
  addMesh(g, new THREE.CylinderGeometry(d * 0.24, throatR, h * 0.16, 24), MATS.metalMid, 0, h * 0.4, 0);
  const t = new THREE.Mesh(new THREE.TorusGeometry(throatR + 0.01, 0.02, 8, 32), MATS.copperDark);
  t.rotation.x = Math.PI / 2;
  t.position.y = h * 0.32;
  g.add(t);
  const bellGeo = new THREE.CylinderGeometry(throatR, exitR, h * 0.78, 48, 1, true);
  const bell = new THREE.Mesh(bellGeo, MATS.engineBell);
  bell.position.y = -h * 0.07;
  bell.userData.isNozzle = true;
  bell.userData.exitR = exitR;
  bell.userData.bellHeight = h * 0.78;
  g.add(bell);
  for (let i = 1; i <= 4; i++) {
    const tt = i / 5;
    const y = h * 0.32 - h * 0.78 * tt;
    const r = throatR + (exitR - throatR) * tt;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.005, 0.008, 6, 48), MATS.copperDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(exitR, 0.02, 8, 48), MATS.copper);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -h * 0.46;
  g.add(lip);
  const gimbal = new THREE.Mesh(new THREE.TorusGeometry(d * 0.32, 0.03, 8, 32), MATS.silver);
  gimbal.rotation.x = Math.PI / 2;
  gimbal.position.y = h * 0.5;
  g.add(gimbal);
  const flame = makeFlameGroup(exitR, h * 0.78);
  flame.position.set(0, -h * 0.46, 0);
  bell.userData.flame = flame;
  g.add(flame);
  return g;
}

// =========================================================
// AVIONICS
// =========================================================
export function makeAvionics(h, d, partId) {
  const g = new THREE.Group();
  const boxW = d * 0.9;

  // Base plate
  addMesh(g, new THREE.BoxGeometry(boxW * 1.05, 0.03, boxW * 1.05), MATS.panelAlum, 0, -h / 2 + 0.02, 0);

  // Main box
  addMesh(g, new THREE.BoxGeometry(boxW, h, boxW), MATS.panelAlum);

  // Panel lines on all 4 sides
  for (const sign of [-1, 1]) {
    addPanelLine(g, -boxW / 2, h * 0.15, boxW / 2, h * 0.15, sign * (boxW / 2 + 0.005));
    addPanelLine(g, -boxW / 2, -h * 0.15, boxW / 2, -h * 0.15, sign * (boxW / 2 + 0.005));
  }

  // Corner bolts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h * 1.02, 6), MATS.metalBlack);
    bolt.position.set(sx * (boxW / 2 - 0.04), 0, sz * (boxW / 2 - 0.04));
    g.add(bolt);
  }

  // Antennas
  const antGeo = new THREE.CylinderGeometry(0.015, 0.015, h * 1.2, 8);
  addMesh(g, antGeo, MATS.silver, boxW / 2 - 0.08, h / 2 + h * 0.4, boxW / 2 - 0.08);
  addMesh(g, antGeo, MATS.silver, -boxW / 2 + 0.08, h / 2 + h * 0.4, -boxW / 2 + 0.08);
  addMesh(g, new THREE.SphereGeometry(0.025, 12, 8), MATS.copper, boxW / 2 - 0.08, h / 2 + h * 1.0, boxW / 2 - 0.08);
  addMesh(g, new THREE.SphereGeometry(0.025, 12, 8), MATS.copper, -boxW / 2 + 0.08, h / 2 + h * 1.0, -boxW / 2 + 0.08);

  // Small dish on top
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.09, 20, 1, true), MATS.dishWhite);
  dish.rotation.x = Math.PI;
  dish.position.set(0, h / 2 + 0.1, 0);
  g.add(dish);
  addMesh(g, new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), MATS.silver, 0, h / 2 + 0.18, 0);

  // Umbilical connector on side
  const umb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), MATS.copper);
  umb.position.set(boxW / 2 + 0.02, 0, 0);
  g.add(umb);

  // Wiring bundle running down the side
  addWireBundle(g, [
    new THREE.Vector3(boxW / 2 + 0.03, h / 2 - 0.05, 0.1),
    new THREE.Vector3(boxW / 2 + 0.03, 0, 0.15),
    new THREE.Vector3(boxW / 2 + 0.02, -h / 2 + 0.1, 0.1),
  ], MATS.metalBlack, 0.012);

  if (partId && partId.includes('star_tracker')) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 24), MATS.metalBlack);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, boxW * 0.4);
    g.add(lens);
    addMesh(g, new THREE.CircleGeometry(0.08, 24), MATS.lensFront, 0, 0, boxW * 0.48);
  }

  if (partId && partId.includes('triple')) {
    for (let i = -1; i <= 1; i++) {
      addMesh(g, new THREE.BoxGeometry(boxW * 0.85, h * 0.25, boxW * 0.85), MATS.panelAlum, 0, i * h * 0.3, 0);
    }
  }

  return g;
}

// =========================================================
// POWER (unchanged — already detailed)
// =========================================================
let SOLAR_TEX = null;
function getSolarTexture() {
  if (SOLAR_TEX) return SOLAR_TEX;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a1230';
  ctx.fillRect(0, 0, 512, 512);
  const cols = 16, rows = 16;
  const cw = 512 / cols, ch = 512 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const shade = (r + c) % 2 === 0 ? '#0d1a55' : '#0a1545';
      ctx.fillStyle = shade;
      ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
      ctx.fillStyle = 'rgba(100, 180, 255, 0.15)';
      ctx.fillRect(c * cw + 2, r * ch + 2, cw * 0.4, 2);
    }
  }
  ctx.strokeStyle = '#2a3a8a';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, 512); ctx.stroke();
  }
  for (let i = 0; i <= rows; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(512, i * ch); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  SOLAR_TEX = tex;
  return tex;
}

export function makePower(h, d, partId) {
  const g = new THREE.Group();

  if (partId && (partId.includes('solar') || partId.includes('array'))) {
    const hubH = Math.max(h * 1.4, 0.35);
    addMesh(g, new THREE.BoxGeometry(d * 0.35, hubH, d * 0.35), MATS.panelAlum);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d * 0.32, 0.035, 10, 32), MATS.silver);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = hubH / 2 - 0.05;
    g.add(ring);
    addMesh(g, new THREE.BoxGeometry(d * 0.2, h * 0.35, d * 0.2), MATS.panelBlue, 0, hubH / 2 + h * 0.15, 0);

    const wingW = d * 2.2;
    const wingH = h * 1.6;
    const solarTex = getSolarTexture();

    for (const sign of [-1, 1]) {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(sign * (d * 0.2), 0, 0);

      const backing = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.03, wingH), MATS.solarFrame);
      backing.position.x = sign * wingW / 2;
      wingGroup.add(backing);

      const frontMat = new THREE.MeshStandardMaterial({
        map: solarTex, metalness: 0.75, roughness: 0.25,
        emissive: 0x061030, emissiveIntensity: 0.4,
      });
      const front = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.98, 0.008, wingH * 0.96), frontMat);
      front.position.set(sign * wingW / 2, 0.02, 0);
      wingGroup.add(front);

      for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, wingH), MATS.solarFrame);
        trim.position.set(sign * (wingW / 2 + side * wingW / 2), 0.025, 0);
        wingGroup.add(trim);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.04, 0.04), MATS.solarFrame);
        rail.position.set(sign * wingW / 2, 0.025, side * wingH / 2);
        wingGroup.add(rail);
      }
      const spine = new THREE.Mesh(new THREE.BoxGeometry(wingW * 1.02, 0.05, 0.06), MATS.solarFrame);
      spine.position.set(sign * wingW / 2, 0.03, 0);
      wingGroup.add(spine);

      g.add(wingGroup);
    }
    return g;
  }

  if (partId && (partId.includes('rtg') || partId.includes('mmrtg'))) {
    addMesh(g, new THREE.CylinderGeometry(d / 2 * 0.72, d / 2 * 0.72, h, 32), MATS.metalDark);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, h * 0.85, d * 1.4), MATS.metalMid);
      fin.rotation.y = a;
      g.add(fin);
    }
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2 * 0.75, 0.015, 6, 32), MATS.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -h / 2 + (i / 4) * h;
      g.add(ring);
    }
    addMesh(g, new THREE.CylinderGeometry(d / 2 * 0.85, d / 2 * 0.72, 0.08, 24), MATS.metalDark, 0, h / 2 + 0.04, 0);
    addMesh(g, new THREE.CylinderGeometry(d / 2 * 0.72, d / 2 * 0.85, 0.08, 24), MATS.metalDark, 0, -h / 2 - 0.04, 0);
    return g;
  }

  if (partId && partId.includes('kilopower')) {
    addMesh(g, new THREE.CylinderGeometry(d * 0.28, d * 0.28, h * 1.3, 32), MATS.silver);
    const radiator = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, 0.05, 48), MATS.metalDark);
    g.add(radiator);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(d * 0.35, 0.02, 0.03), MATS.metalMid);
      fin.position.set(Math.cos(a) * d * 0.28, 0.035, Math.sin(a) * d * 0.28);
      fin.rotation.y = -a;
      g.add(fin);
    }
    addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, h * 1.5, 12), MATS.copper, 0, h * 0.75, 0);
    return g;
  }

  if (partId && partId.includes('reactor_large')) {
    addMesh(g, new THREE.CylinderGeometry(d * 0.42, d * 0.42, h, 32), MATS.silver);
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(d * 0.44, 0.05, 8, 32), MATS.metalDark);
      r.rotation.x = Math.PI / 2;
      r.position.y = -h / 2 + (i / 3) * h;
      g.add(r);
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(d * 1.1, 0.5, 48), MATS.metalBlack);
    cone.position.y = -h / 2 - 0.3;
    cone.rotation.x = Math.PI;
    g.add(cone);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(d * 0.6, 0.01, 0.04), MATS.metalMid);
      fin.position.set(Math.cos(a) * d * 0.55, -h / 2 - 0.15, Math.sin(a) * d * 0.55);
      fin.rotation.y = -a;
      g.add(fin);
    }
    return g;
  }

  if (partId && partId.includes('fuel_cell')) {
    addMesh(g, new THREE.BoxGeometry(d * 0.95, h, d * 0.75), MATS.panelAlum);
    addPanelLine(g, -d * 0.45, h * 0.2, d * 0.45, h * 0.2, d * 0.38);
    addPanelLine(g, -d * 0.45, -h * 0.2, d * 0.45, -h * 0.2, d * 0.38);
    addMesh(g, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12), MATS.copper, d * 0.3, h * 0.65, 0);
    addMesh(g, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12), MATS.copper, -d * 0.3, h * 0.65, 0);
    return g;
  }

  // Battery
  addMesh(g, new THREE.BoxGeometry(d * 0.95, h, d * 0.8), MATS.panelAlum);
  addPanelLine(g, -d * 0.45, h * 0.35, d * 0.45, h * 0.35, d * 0.41);
  addPanelLine(g, -d * 0.45, -h * 0.35, d * 0.45, -h * 0.35, d * 0.41);
  return g;
}

// =========================================================
// PAYLOAD BUS — shared base for every payload
// =========================================================
function makePayloadBus(h, d) {
  const g = new THREE.Group();
  const w = d * 0.95;
  const baseY = -h / 2;
  const railH = h * 0.7;
  const busTopY = -h / 2 + railH;

  // Base plate — octagonal mount
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(w / 2, w / 2 * 0.95, 0.06, 8),
    MATS.panelAlum
  );
  basePlate.position.y = baseY + 0.03;
  g.add(basePlate);

  // Bolt ring on base plate
  addBoltRing(g, 8, w * 0.4, baseY + 0.07, 0.022);

  // 4 corner vertical rails
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * (w / 2 - 0.04);
    const z = Math.sin(a) * (w / 2 - 0.04);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, railH, 0.06),
      MATS.carbon
    );
    rail.position.set(x, baseY + railH / 2, z);
    g.add(rail);
  }

  // Side panels between rails (4 panels)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * (w / 2);
    const z = Math.sin(a) * (w / 2);
    const panelW = w * 0.72;

    // Alternate solid panel and MLI blanket
    const isMLI = i % 2 === 1;
    const panelMat = isMLI ? MATS.mli : MATS.panelAlum;

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(panelW, railH * 0.85, 0.02),
      panelMat
    );
    panel.position.set(x * 0.98, baseY + railH / 2, z * 0.98);
    panel.rotation.y = -a;
    g.add(panel);

    // Panel line detail on solid panels
    if (!isMLI) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(panelW, 0.008, 0.025),
        MATS.metalBlack
      );
      line.position.set(x * 0.99, baseY + railH * 0.5, z * 0.99);
      line.rotation.y = -a;
      g.add(line);
    } else {
      // Add MLI seam ridge
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, railH * 0.75, 0.03),
        MATS.metalDark
      );
      seam.position.set(x * 0.99, baseY + railH / 2, z * 0.99);
      seam.rotation.y = -a;
      g.add(seam);
    }
  }

  // Top plate
  const topPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(w / 2 * 0.9, w / 2, 0.05, 8),
    MATS.panelAlum
  );
  topPlate.position.y = busTopY;
  g.add(topPlate);
  addBoltRing(g, 6, w * 0.35, busTopY + 0.03, 0.02);

  // Umbilical connector on one side
  const umb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), MATS.copper);
  umb.position.set(w / 2 + 0.02, baseY + railH * 0.3, 0);
  g.add(umb);
  // Connector pins
  for (let i = 0; i < 4; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), MATS.copperDark);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(w / 2 + 0.05, baseY + railH * 0.3 - 0.05 + i * 0.03, 0);
    g.add(pin);
  }

  // Wiring bundle running from umbilical up to top plate
  addWireBundle(g, [
    new THREE.Vector3(w / 2 + 0.03, baseY + railH * 0.3, 0),
    new THREE.Vector3(w / 2 - 0.02, baseY + railH * 0.5, 0.05),
    new THREE.Vector3(w / 2 - 0.1, baseY + railH * 0.85, 0.08),
    new THREE.Vector3(w / 2 - 0.15, busTopY + 0.05, 0.1),
  ], MATS.metalBlack, 0.012);

  // Second wire bundle on the opposite side
  addWireBundle(g, [
    new THREE.Vector3(-w / 2 + 0.02, baseY + railH * 0.15, 0.1),
    new THREE.Vector3(-w / 2 + 0.05, baseY + railH * 0.5, 0.08),
    new THREE.Vector3(-w / 2 + 0.1, baseY + railH * 0.9, 0.05),
  ], MATS.metalBlack, 0.01);

  // Small status LED indicator on one panel
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x44ff66, emissive: 0x44ff66, emissiveIntensity: 2 })
  );
  led.position.set(0, baseY + railH * 0.6, w / 2 + 0.02);
  g.add(led);

  // Corner vent ports
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * (w / 2 - 0.02);
    const z = Math.sin(a) * (w / 2 - 0.02);
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.03),
      MATS.metalDark
    );
    vent.position.set(x, baseY + railH * 0.85, z);
    vent.rotation.y = -a;
    g.add(vent);
  }

  g.userData.busTopY = busTopY;
  return g;
}

// =========================================================
// INSTRUMENT MODULES
// =========================================================

function makeCameraModule(h, d, hires = false) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const barrel = d * 0.55;

  // Mounted on a gimbal
  const gimbalBase = new THREE.Mesh(new THREE.CylinderGeometry(barrel * 0.7, barrel * 0.7, 0.06, 20), MATS.metalMid);
  gimbalBase.position.y = y - 0.04;
  g.add(gimbalBase);

  const gimbalRing = new THREE.Mesh(new THREE.TorusGeometry(barrel * 0.6, 0.025, 8, 20), MATS.silver);
  gimbalRing.rotation.x = Math.PI / 2;
  gimbalRing.position.y = y + 0.02;
  g.add(gimbalRing);

  // Camera body
  const bodyH = barrel * 0.9;
  addMesh(g, new THREE.CylinderGeometry(barrel * 0.55, barrel * 0.55, bodyH, 28), MATS.panelAlum, 0, y + bodyH / 2 + 0.04, 0);

  // Panel line across body
  const pl = new THREE.Mesh(new THREE.TorusGeometry(barrel * 0.56, 0.006, 6, 28), MATS.metalBlack);
  pl.rotation.x = Math.PI / 2;
  pl.position.y = y + bodyH / 2 + 0.04;
  g.add(pl);

  const numLenses = hires ? 3 : 1;
  const lensSpacing = numLenses === 1 ? 0 : barrel * 0.85;
  for (let i = 0; i < numLenses; i++) {
    const off = numLenses === 1 ? 0 : (i - (numLenses - 1) / 2) * lensSpacing;

    // Lens barrel (extends outward)
    const barrelLen = barrel * 1.0;
    const lensBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(barrel * 0.28, barrel * 0.28, barrelLen, 24),
      MATS.metalBlack
    );
    lensBarrel.rotation.x = Math.PI / 2;
    lensBarrel.position.set(off, y + bodyH / 2 + 0.04, barrel * 0.55 + barrelLen / 2);
    g.add(lensBarrel);

    // Inner ring detail
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(barrel * 0.22, 0.012, 6, 24),
      MATS.copper
    );
    innerRing.position.set(off, y + bodyH / 2 + 0.04, barrel * 0.55 + barrelLen);
    g.add(innerRing);

    // Front glass element (multiple layers for depth)
    const glassOuter = new THREE.Mesh(
      new THREE.CircleGeometry(barrel * 0.2, 24),
      MATS.lensFront
    );
    glassOuter.position.set(off, y + bodyH / 2 + 0.04, barrel * 0.55 + barrelLen + 0.005);
    g.add(glassOuter);

    const glassInner = new THREE.Mesh(
      new THREE.CircleGeometry(barrel * 0.12, 20),
      MATS.lensGlass
    );
    glassInner.position.set(off, y + bodyH / 2 + 0.04, barrel * 0.55 + barrelLen * 0.7);
    g.add(glassInner);

    // Aperture ring (bronze)
    const aperture = new THREE.Mesh(
      new THREE.TorusGeometry(barrel * 0.26, 0.008, 6, 24),
      MATS.copper
    );
    aperture.position.set(off, y + bodyH / 2 + 0.04, barrel * 0.55 + barrelLen + 0.01);
    g.add(aperture);

    // Lens hood (flared cone, opens outward)
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(barrel * 0.42, barrel * 0.3, barrel * 0.4, 24, 1, true),
      MATS.metalBlack
    );
    hood.rotation.x = Math.PI / 2;
    hood.position.set(off, y + bodyH / 2 + 0.04, barrel * 0.55 + barrelLen + barrel * 0.25);
    g.add(hood);
  }

  // Data cable from camera body down to bus
  addWireBundle(g, [
    new THREE.Vector3(0, y + 0.04, -barrel * 0.55),
    new THREE.Vector3(0, y - 0.4, -barrel * 0.5),
    new THREE.Vector3(0.05, y - 0.8, -barrel * 0.4),
  ], MATS.metalBlack, 0.014);

  return g;
}

function makeSpectrometerModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const base = d * 0.5;

  // Mounting bracket
  addMesh(g, new THREE.BoxGeometry(base, 0.06, base * 0.7), MATS.metalMid, 0, y - 0.04, 0);

  // Main housing
  addMesh(g, new THREE.BoxGeometry(base * 0.9, base * 0.7, base * 0.8), MATS.panelAlum, 0, y + base * 0.35, 0);
  addPanelLine(g, -base * 0.45, y + base * 0.35, base * 0.45, y + base * 0.35, base * 0.4 + 0.005);

  // Inlet horn — tapered cone pointing up
  const horn = new THREE.Mesh(
    new THREE.CylinderGeometry(base * 0.35, base * 0.12, base * 0.55, 24, 1, true),
    MATS.copper
  );
  horn.position.y = y + base * 0.95;
  g.add(horn);

  // Baffle rings inside horn
  for (let i = 0; i < 3; i++) {
    const r = base * 0.12 + (base * 0.35 - base * 0.12) * (i / 3);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 20), MATS.copperDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y + base * 0.75 + i * base * 0.13;
    g.add(ring);
  }

  // Top lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(base * 0.35, 0.012, 6, 24), MATS.copperDark);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = y + base * 1.22;
  g.add(lip);

  // Detector array — small cylinders on the side
  for (let i = 0; i < 3; i++) {
    const det = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.15, 12), MATS.metalBlack);
    det.rotation.z = Math.PI / 2;
    det.position.set(base * 0.5, y + base * 0.4 + i * 0.12, 0);
    g.add(det);
  }

  // Data cable
  addWireBundle(g, [
    new THREE.Vector3(0, y - 0.04, -base * 0.3),
    new THREE.Vector3(0.05, y - 0.5, -base * 0.3),
  ], MATS.metalBlack, 0.012);

  return g;
}

function makeRadarModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Gimbal mount
  addMesh(g, new THREE.BoxGeometry(size * 0.6, 0.08, size * 0.6), MATS.metalMid, 0, y - 0.04, 0);
  addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.15, 12), MATS.silver, 0, y + 0.07, 0);

  // Dish — use LatheGeometry for a proper parabolic curve
  const points = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = t * size * 0.5;
    const py = -t * t * size * 0.35;
    points.push(new THREE.Vector2(r, py));
  }
  const dishGeo = new THREE.LatheGeometry(points, 40);
  const dish = new THREE.Mesh(dishGeo, MATS.dishGold);
  dish.position.y = y + size * 0.55;
  dish.rotation.x = Math.PI;
  g.add(dish);

  // Back rim ring
  const rim = new THREE.Mesh(new THREE.TorusGeometry(size * 0.5, 0.015, 8, 40), MATS.metalMid);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = y + size * 0.55 - size * 0.35;
  g.add(rim);

  // Feed horn on 3 struts
  const feedY = y + size * 0.55 + size * 0.15;
  addMesh(g, new THREE.ConeGeometry(0.04, 0.1, 12), MATS.copper, 0, feedY, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, size * 0.5, 6), MATS.silver);
    strut.position.set(Math.cos(a) * size * 0.25, feedY - size * 0.15, Math.sin(a) * size * 0.25);
    strut.rotation.z = Math.atan2(size * 0.25, size * 0.3);
    strut.rotation.y = -a;
    g.add(strut);
  }

  // Waveguide from dish back to bus
  addWireBundle(g, [
    new THREE.Vector3(0, y + size * 0.2, 0),
    new THREE.Vector3(0.1, y - 0.1, 0.05),
    new THREE.Vector3(0.15, y - 0.35, 0.1),
  ], MATS.copper, 0.018);

  return g;
}

function makeMagnetometerModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Deployment canister at the base
  addMesh(g, new THREE.BoxGeometry(size * 0.5, 0.12, size * 0.4), MATS.metalMid, -size * 0.3, y, 0);

  // Telescoping boom — 3 segments decreasing in diameter
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, size * 0.6, 12), MATS.silver);
  seg1.rotation.z = Math.PI / 2;
  seg1.position.set(-size * 0.05, y + 0.02, 0);
  g.add(seg1);

  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, size * 0.5, 12), MATS.silver);
  seg2.rotation.z = Math.PI / 2;
  seg2.position.set(size * 0.5, y + 0.02, 0);
  g.add(seg2);

  const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, size * 0.4, 12), MATS.silver);
  seg3.rotation.z = Math.PI / 2;
  seg3.position.set(size * 0.95, y + 0.02, 0);
  g.add(seg3);

  // Connector rings between segments
  for (const x of [size * 0.25, size * 0.75]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12), MATS.metalDark);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, y + 0.02, 0);
    g.add(ring);
  }

  // Sensor cluster at the tip — 3-axis fluxgate
  addMesh(g, new THREE.SphereGeometry(0.08, 16, 12), MATS.metalDark, size * 1.2, y + 0.02, 0);
  // Three orthogonal sensor bars
  addMesh(g, new THREE.BoxGeometry(0.22, 0.02, 0.02), MATS.copper, size * 1.2, y + 0.02, 0);
  addMesh(g, new THREE.BoxGeometry(0.02, 0.22, 0.02), MATS.copper, size * 1.2, y + 0.02, 0);
  addMesh(g, new THREE.BoxGeometry(0.02, 0.02, 0.22), MATS.copper, size * 1.2, y + 0.02, 0);

  // Cable running along boom
  addWireBundle(g, [
    new THREE.Vector3(-size * 0.2, y + 0.05, 0.03),
    new THREE.Vector3(size * 0.4, y + 0.05, 0.03),
    new THREE.Vector3(size * 1.1, y + 0.05, 0.03),
  ], MATS.metalBlack, 0.008);

  return g;
}

function makeDrillModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Housing
  addMesh(g, new THREE.BoxGeometry(size * 0.7, size * 0.5, size * 0.6), MATS.metalMid, 0, y + size * 0.25, 0);
  addPanelLine(g, -size * 0.35, y + size * 0.25, size * 0.35, y + size * 0.25, size * 0.3 + 0.005);

  // Rotary percussive head
  addMesh(g, new THREE.CylinderGeometry(0.06, 0.06, size * 0.4, 20), MATS.silver, 0, y + size * 0.7, 0);

  // Auger bit with visible flutes (helical)
  const flutes = 6;
  const bitLen = size * 0.9;
  const bitR = 0.04;
  const tipY = y + size * 0.9 + bitLen / 2;

  // Central shaft
  addMesh(g, new THREE.CylinderGeometry(bitR * 0.4, bitR * 0.4, bitLen, 8), MATS.silver, 0, tipY, 0);

  // Helical flutes
  for (let i = 0; i < flutes; i++) {
    const a = (i / flutes) * Math.PI * 2;
    const helixPoints = [];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      const yp = y + size * 0.9 + t * bitLen;
      const ang = a + t * Math.PI * 2.5;
      helixPoints.push(new THREE.Vector3(Math.cos(ang) * bitR, yp, Math.sin(ang) * bitR));
    }
    const curve = new THREE.CatmullRomCurve3(helixPoints);
    const flute = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 6, false), MATS.metalMid);
    g.add(flute);
  }

  // Drill tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(bitR * 1.3, bitR * 2, 12), MATS.copper);
  tip.position.y = y + size * 0.9 + bitLen + bitR;
  g.add(tip);

  // Sample canister attached to the housing
  const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16), MATS.panelAlum);
  canister.position.set(size * 0.4, y + size * 0.25, 0);
  g.add(canister);
  // Glass window on canister
  const window = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), MATS.glass);
  window.rotation.y = Math.PI / 2;
  window.position.set(size * 0.4 + 0.051, y + size * 0.25, 0);
  g.add(window);

  // Actuator cylinders
  for (const sx of [-1, 1]) {
    const act = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, size * 0.5, 10), MATS.copper);
    act.position.set(sx * size * 0.3, y + size * 0.6, 0);
    g.add(act);
  }

  return g;
}

function makeRoverModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // Chassis — flat plate
  addMesh(g, new THREE.BoxGeometry(size * 1.1, 0.08, size * 0.7), MATS.panelAlum, 0, y + 0.2, 0);

  // Top deck equipment box
  addMesh(g, new THREE.BoxGeometry(size * 0.6, 0.15, size * 0.5), MATS.panelAlum, 0, y + 0.32, 0);
  addPanelLine(g, -size * 0.3, y + 0.32, size * 0.3, y + 0.32, size * 0.25 + 0.005);

  // Solar panel on top
  const solarTex = getSolarTexture();
  const panelMat = new THREE.MeshStandardMaterial({
    map: solarTex, metalness: 0.75, roughness: 0.25,
    emissive: 0x061030, emissiveIntensity: 0.4,
  });
  const solar = new THREE.Mesh(new THREE.BoxGeometry(size * 1.2, 0.01, size * 0.8), panelMat);
  solar.position.set(0, y + 0.42, 0);
  g.add(solar);
  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(size * 1.25, 0.015, size * 0.85), MATS.solarFrame);
  frame.position.set(0, y + 0.41, 0);
  g.add(frame);

  // Mast with camera head
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, size * 0.5, 10), MATS.silver);
  mast.position.set(size * 0.5, y + 0.7, 0);
  g.add(mast);
  const mastHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), MATS.metalDark);
  mastHead.position.set(size * 0.5, y + 0.95, 0);
  g.add(mastHead);
  // Camera lens on mast head
  const mcam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), MATS.metalBlack);
  mcam.rotation.x = Math.PI / 2;
  mcam.position.set(size * 0.5, y + 0.95, 0.06);
  g.add(mcam);
  addMesh(g, new THREE.CircleGeometry(0.018, 12), MATS.lensFront, size * 0.5, y + 0.95, 0.09);

  // Rocker-bogie suspension (simplified: 3 arms per side)
  for (const side of [-1, 1]) {
    const z = side * size * 0.35;

    // Rocker arm
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, 0.04, 0.03), MATS.metalDark);
    rocker.position.set(0, y + 0.1, z);
    g.add(rocker);

    // 6 wheels — 3 per side
    for (let i = 0; i < 3; i++) {
      const wx = (i - 1) * size * 0.35;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), MATS.metalBlack);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, y + 0.02, z);
      g.add(wheel);
      // Hub cap
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), MATS.copper);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(wx, y + 0.02, z);
      g.add(hub);

      // Suspension arm from rocker to wheel
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), MATS.silver);
      arm.position.set(wx, y + 0.06, z);
      g.add(arm);
    }
  }

  // Sample arm (folded)
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.5, 0.03, 0.03), MATS.silver);
  arm1.position.set(-size * 0.55, y + 0.2, size * 0.2);
  g.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.3, 0.02, 0.02), MATS.silver);
  arm2.position.set(-size * 0.75, y + 0.35, size * 0.2);
  arm2.rotation.z = 0.5;
  g.add(arm2);

  // Communications antenna
  const antBase = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), MATS.silver);
  antBase.position.set(-size * 0.4, y + 0.5, -size * 0.15);
  g.add(antBase);
  const antDish = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.04, 12, 1, true), MATS.dishWhite);
  antDish.rotation.x = Math.PI;
  antDish.position.set(-size * 0.4, y + 0.57, -size * 0.15);
  g.add(antDish);

  return g;
}

function makeSampleReturnModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Heat shield — ablative dome with tile lines
  const heatPoints = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = Math.sin(Math.PI * t * 0.5) * size * 0.5;
    const yy = -Math.cos(Math.PI * t * 0.5) * size * 0.4;
    heatPoints.push(new THREE.Vector2(r, yy));
  }
  const heatGeo = new THREE.LatheGeometry(heatPoints, 32);
  const heatShield = new THREE.Mesh(heatGeo, MATS.noseAblative);
  heatShield.position.set(0, y + size * 0.2, 0);
  g.add(heatShield);

  // Tile lines radiating on the heat shield
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.005, size * 0.35, 0.005), MATS.metalDark);
    line.position.set(Math.cos(a) * size * 0.2, y + size * 0.15, Math.sin(a) * size * 0.2);
    g.add(line);
  }

  // Backshell — capsule body
  const backGeo = new THREE.SphereGeometry(size * 0.5, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.7);
  const back = new THREE.Mesh(backGeo, MATS.nose);
  back.position.set(0, y + size * 0.2, 0);
  g.add(back);

  // Backshell panel line
  const pl = new THREE.Mesh(new THREE.TorusGeometry(size * 0.35, 0.006, 6, 32), MATS.metalBlack);
  pl.rotation.x = Math.PI / 2;
  pl.position.y = y + size * 0.45;
  g.add(pl);

  // Parachute housing on top
  addMesh(g, new THREE.CylinderGeometry(size * 0.18, size * 0.18, size * 0.15, 20), MATS.metalMid, 0, y + size * 0.75, 0);
  addMesh(g, new THREE.CylinderGeometry(size * 0.1, size * 0.18, 0.03, 20), MATS.metalDark, 0, y + size * 0.84, 0);

  // Small window into the sample canister
  const window = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), MATS.glass);
  window.position.set(size * 0.35, y + size * 0.35, size * 0.25);
  window.lookAt(size * 0.35, y + size * 0.35, size * 0.4);
  g.add(window);
  // Window ring
  const wring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16), MATS.copper);
  wring.position.copy(window.position);
  wring.lookAt(size * 0.35, y + size * 0.35, size * 0.5);
  g.add(wring);

  // Separation motor around the base
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12), MATS.metalDark);
    motor.position.set(Math.cos(a) * size * 0.55, y + size * 0.15, Math.sin(a) * size * 0.55);
    motor.rotation.z = Math.PI / 2;
    motor.rotation.y = -a;
    g.add(motor);
  }

  return g;
}

function makeAstrobiologyModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Base processing unit
  addMesh(g, new THREE.BoxGeometry(size * 1.0, size * 0.5, size * 0.8), MATS.panelAlum, 0, y + size * 0.25, 0);
  addPanelLine(g, -size * 0.5, y + size * 0.25, size * 0.5, y + size * 0.25, size * 0.4 + 0.005);

  // Sample intake port (iris)
  const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 20), MATS.copper);
  intake.position.set(size * 0.5, y + size * 0.15, 0);
  intake.rotation.z = Math.PI / 2;
  g.add(intake);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const iris = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.005), MATS.metalDark);
    iris.position.set(size * 0.5 + 0.051, y + size * 0.15 + Math.cos(a) * 0.05, Math.sin(a) * 0.05);
    g.add(iris);
  }

  // Processing chamber (glass window)
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, size * 0.4, 24), MATS.silver);
  chamber.position.set(0, y + size * 0.7, 0);
  g.add(chamber);
  // Glass window
  const wGeo = new THREE.CylinderGeometry(0.1, 0.1, size * 0.35, 24, 1, true);
  const wMat = new THREE.MeshStandardMaterial({
    color: 0xaaccff, transparent: true, opacity: 0.35, metalness: 0.9, roughness: 0.05,
    side: THREE.DoubleSide, emissive: 0x334488, emissiveIntensity: 0.2,
  });
  g.add(new THREE.Mesh(wGeo, wMat));

  // Microscope head above chamber
  const microBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, size * 0.3, 20), MATS.metalDark);
  microBody.position.set(0, y + size * 1.05, 0);
  g.add(microBody);
  // Microscope eyepiece (angled)
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12), MATS.metalMid);
  eyepiece.position.set(size * 0.06, y + size * 1.15, 0);
  eyepiece.rotation.z = 0.4;
  g.add(eyepiece);

  // Fluid lines running around the outside
  addWireBundle(g, [
    new THREE.Vector3(-size * 0.5, y + size * 0.1, size * 0.3),
    new THREE.Vector3(-size * 0.3, y + size * 0.4, size * 0.35),
    new THREE.Vector3(size * 0.2, y + size * 0.5, size * 0.35),
    new THREE.Vector3(size * 0.4, y + size * 0.15, size * 0.3),
  ], MATS.copper, 0.008);

  // Waste vent
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12), MATS.metalDark);
  vent.position.set(-size * 0.5, y + size * 0.2, -size * 0.3);
  vent.rotation.z = Math.PI / 2;
  g.add(vent);

  return g;
}

function makeLidarModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Optical bench
  addMesh(g, new THREE.BoxGeometry(size * 1.1, 0.04, size * 0.8), MATS.metalMid, 0, y - 0.02, 0);

  // Housing
  addMesh(g, new THREE.BoxGeometry(size * 0.9, size * 0.5, size * 0.7), MATS.panelAlum, 0, y + size * 0.23, 0);

  // Receive telescope
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, size * 0.5, 24), MATS.metalDark);
  scope.rotation.z = Math.PI / 2;
  scope.position.set(-size * 0.55, y + size * 0.3, 0);
  g.add(scope);
  // Lens at end of scope
  addMesh(g, new THREE.CircleGeometry(0.085, 24), MATS.lensFront, -size * 0.55 - size * 0.25 - 0.005, y + size * 0.3, 0).rotation.y = -Math.PI / 2;

  // Laser aperture
  const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 16), MATS.metalBlack);
  laser.rotation.z = Math.PI / 2;
  laser.position.set(-size * 0.55, y + size * 0.12, 0);
  g.add(laser);

  // Cooling fins on top
  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.15, 0.015), MATS.metalMid);
    fin.position.set(0, y + size * 0.55, (i - 2) * 0.05);
    g.add(fin);
  }

  // Gimbal at base
  addMesh(g, new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16), MATS.metalDark, 0, y - 0.1, 0);

  return g;
}

function makeIceMapperModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Combined radar + neutron detector stack
  addMesh(g, new THREE.BoxGeometry(size * 0.9, size * 0.4, size * 0.7), MATS.panelAlum, 0, y + size * 0.22, 0);

  // Dish antenna
  const dishPoints = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    dishPoints.push(new THREE.Vector2(t * size * 0.45, -t * t * size * 0.3));
  }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPoints, 32), MATS.dishWhite);
  dish.position.y = y + size * 0.55;
  dish.rotation.x = Math.PI;
  g.add(dish);

  // Feed horn
  addMesh(g, new THREE.ConeGeometry(0.04, 0.08, 12), MATS.copper, 0, y + size * 0.7, 0);

  // Neutron detector — wrapped cylinder
  const det = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, size * 0.3, 20), MATS.mli);
  det.position.set(size * 0.5, y + size * 0.4, 0);
  det.rotation.z = Math.PI / 2;
  g.add(det);
  // PMT
  addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), MATS.metalDark, size * 0.5 + size * 0.15, y + size * 0.4, 0).rotation.z = Math.PI / 2;

  return g;
}

function makeMicroRoverModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.55;

  // 4 tiny rovers stacked
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const ox = (col - 0.5) * size * 0.55;
    const oz = (row - 0.5) * size * 0.55;

    // Rover body
    addMesh(g, new THREE.BoxGeometry(size * 0.4, 0.06, size * 0.3), MATS.silver, ox, y + 0.15, oz);

    // Solar panel on top
    const panelMat = new THREE.MeshStandardMaterial({
      map: getSolarTexture(), metalness: 0.75, roughness: 0.25,
      emissive: 0x061030, emissiveIntensity: 0.4,
    });
    addMesh(g, new THREE.BoxGeometry(size * 0.45, 0.008, size * 0.35), panelMat, ox, y + 0.19, oz);

    // 4 tiny wheels
    for (const [sx, sz] of [[-0.1, 0.08], [0.1, 0.08], [-0.1, -0.08], [0.1, -0.08]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12), MATS.metalBlack);
      w.rotation.x = Math.PI / 2;
      w.position.set(ox + sx * size, y + 0.11, oz + sz * size);
      g.add(w);
    }

    // Mast
    addMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), MATS.silver, ox + size * 0.1, y + 0.27, oz);
    addMesh(g, new THREE.BoxGeometry(0.03, 0.02, 0.02), MATS.metalDark, ox + size * 0.1, y + 0.34, oz);
  }

  // Deployment base
  addMesh(g, new THREE.BoxGeometry(size * 1.3, 0.05, size * 1.3), MATS.metalMid, 0, y - 0.02, 0);

  return g;
}

function makeWeatherModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Base plate
  addMesh(g, new THREE.BoxGeometry(size * 0.8, 0.06, size * 0.8), MATS.panelAlum, 0, y - 0.02, 0);

  // Central mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, size * 1.6, 10), MATS.silver);
  mast.position.y = y + size * 0.8;
  g.add(mast);

  // Guy wires (3)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, size * 1.6, 4), MATS.metalDark);
    const tilt = Math.atan2(size * 0.5, size * 1.4);
    wire.position.set(Math.cos(a) * size * 0.25, y + size * 0.75, Math.sin(a) * size * 0.25);
    wire.rotation.z = tilt;
    wire.rotation.y = -a;
    g.add(wire);
  }

  // Anemometer at top — 3 spinning cups
  const anemoHub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), MATS.metalDark);
  anemoHub.position.y = y + size * 1.62;
  g.add(anemoHub);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.008), MATS.silver);
    arm.position.set(Math.cos(a) * 0.075, y + size * 1.62, Math.sin(a) * 0.075);
    arm.rotation.y = -a;
    g.add(arm);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6, 0, Math.PI), MATS.silver);
    cup.position.set(Math.cos(a) * 0.15, y + size * 1.62, Math.sin(a) * 0.15);
    g.add(cup);
  }

  // Wind vane
  const vaneHub = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8), MATS.metalDark);
  vaneHub.position.y = y + size * 1.5;
  g.add(vaneHub);
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.03), MATS.silver);
  vane.position.set(0.05, y + size * 1.5, 0);
  g.add(vane);
  const vaneTail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.001), MATS.silver);
  vaneTail.position.set(-0.1, y + size * 1.5, 0);
  g.add(vaneTail);

  // Thermometer shield (white louvred cylinder)
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), MATS.nose);
  shield.position.y = y + size * 1.2;
  g.add(shield);
  // Louvres
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.004, 4, 12), MATS.metalMid);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y + size * 1.16 + i * 0.02;
    g.add(ring);
  }

  // Pressure port (small box)
  addMesh(g, new THREE.BoxGeometry(0.04, 0.03, 0.03), MATS.metalDark, 0, y + size * 1.0, 0.05);

  return g;
}

function makeSeismometerModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Levelling base with 3 screws
  addMesh(g, new THREE.CylinderGeometry(size * 0.4, size * 0.42, 0.04, 20), MATS.metalDark, 0, y + 0.02, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), MATS.copper);
    screw.position.set(Math.cos(a) * size * 0.32, y - 0.02, Math.sin(a) * size * 0.32);
    g.add(screw);
  }

  // Dome housing
  const domeGeo = new THREE.SphereGeometry(size * 0.32, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const dome = new THREE.Mesh(domeGeo, MATS.metalLight);
  dome.position.y = y + 0.04;
  g.add(dome);
  // Dome seam
  const seam = new THREE.Mesh(new THREE.TorusGeometry(size * 0.32, 0.005, 6, 32), MATS.metalBlack);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = y + 0.04;
  g.add(seam);

  // Sunshade cover on top
  const cover = new THREE.Mesh(new THREE.ConeGeometry(size * 0.35, 0.06, 24), MATS.mli);
  cover.position.y = y + size * 0.2;
  g.add(cover);

  // Cable to bus
  addWireBundle(g, [
    new THREE.Vector3(0, y + 0.04, -size * 0.3),
    new THREE.Vector3(size * 0.1, y - 0.3, -size * 0.35),
    new THREE.Vector3(size * 0.2, y - 0.6, -size * 0.3),
  ], MATS.metalBlack, 0.012);

  return g;
}

function makeAtmosphericSamplerModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Inlet scoop at front
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(size * 0.4, 0.08, size * 0.3), MATS.copper);
  scoop.position.set(0, y + 0.15, size * 0.35);
  g.add(scoop);
  // Scoop opening
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(size * 0.35, 0.06, 0.02), MATS.metalBlack);
  mouth.position.set(0, y + 0.15, size * 0.5 + 0.01);
  g.add(mouth);

  // Filter housing
  addMesh(g, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), MATS.metalMid, 0, y + 0.15, size * 0.15);

  // Pump assembly
  addMesh(g, new THREE.BoxGeometry(0.12, 0.1, 0.08), MATS.metalDark, 0, y + 0.15, -size * 0.05);

  // Sample bottles — 4 small cylinders
  for (let i = 0; i < 4; i++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12), MATS.silver);
    bottle.position.set((i - 1.5) * 0.06, y + 0.15, -size * 0.25);
    g.add(bottle);
    // Cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 12), MATS.copper);
    cap.position.set((i - 1.5) * 0.06, y + 0.19, -size * 0.25);
    g.add(cap);
  }

  // Housing for the bottle rack
  addMesh(g, new THREE.BoxGeometry(size * 0.6, 0.14, 0.1), MATS.panelAlum, 0, y + 0.1, -size * 0.25);

  // Intake tube from scoop to pump
  addWireBundle(g, [
    new THREE.Vector3(0, y + 0.15, size * 0.35),
    new THREE.Vector3(0.05, y + 0.18, size * 0.1),
    new THREE.Vector3(0, y + 0.15, 0),
  ], MATS.copper, 0.012);

  return g;
}

function makeXrayModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Detector housing
  addMesh(g, new THREE.CylinderGeometry(size * 0.35, size * 0.35, size * 0.6, 24), MATS.metalMid, 0, y + size * 0.3, 0);

  // Aperture at the front
  addMesh(g, new THREE.CylinderGeometry(size * 0.28, size * 0.28, 0.04, 24), MATS.metalBlack, 0, y + size * 0.6, 0);
  // Aperture hole
  addMesh(g, new THREE.CircleGeometry(size * 0.15, 24), MATS.glass, 0, y + size * 0.62, 0).rotation.x = -Math.PI / 2;

  // Filter wheel (visible slots)
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.25, size * 0.25, 0.03, 16), MATS.copper);
  wheel.position.y = y + size * 0.45;
  g.add(wheel);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), MATS.metalBlack);
    slot.position.set(Math.cos(a) * size * 0.15, y + size * 0.465, Math.sin(a) * size * 0.15);
    slot.rotation.x = -Math.PI / 2;
    g.add(slot);
  }

  // Cooling strap
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, size * 0.6, size * 0.15), MATS.silver);
  strap.position.set(size * 0.36, y + size * 0.3, 0);
  g.add(strap);

  // Base
  addMesh(g, new THREE.BoxGeometry(size * 0.7, 0.05, size * 0.7), MATS.metalDark, 0, y - 0.02, 0);

  return g;
}

function makeNeutronModule(h, d) {
  const g = new THREE.Group();
  const y = h / 2 - 0.02;
  const size = d * 0.5;

  // Boron-loaded plastic cylinder wrapped in MLI
  const detector = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, size * 0.6, 24), MATS.mli);
  detector.rotation.z = Math.PI / 2;
  detector.position.set(-size * 0.15, y + size * 0.3, 0);
  g.add(detector);

  // Straps holding the MLI
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.103, 0.006, 6, 24), MATS.metalDark);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-size * 0.15 + (i - 1.5) * 0.12, y + size * 0.3, 0);
    g.add(ring);
  }

  // PMT (photomultiplier tube) at the end
  const pmt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16), MATS.metalDark);
  pmt.rotation.z = Math.PI / 2;
  pmt.position.set(-size * 0.15 - size * 0.35, y + size * 0.3, 0);
  g.add(pmt);

  // HV cable
  addWireBundle(g, [
    new THREE.Vector3(-size * 0.15 - size * 0.42, y + size * 0.3, 0),
    new THREE.Vector3(-size * 0.4, y + size * 0.15, 0.05),
    new THREE.Vector3(-size * 0.4, y - 0.05, 0.05),
  ], MATS.metalBlack, 0.012);

  // Base housing
  addMesh(g, new THREE.BoxGeometry(size * 0.5, 0.15, size * 0.3), MATS.panelAlum, size * 0.35, y + size * 0.08, 0);

  return g;
}

// =========================================================
// PAYLOAD DISPATCHER
// =========================================================
export function makePayload(h, d, partId) {
  // Build the payload in an inner group, then measure its bounding box
  // and scale/position it so it always fits inside the slot's segment.
  // This guarantees nothing pokes through the nose cone above.
  const outer = new THREE.Group();
  const content = new THREE.Group();
  outer.add(content);

  const bus = makePayloadBus(h, d);
  content.add(bus);

  // Instrument sits on top of the bus
  let instrument = null;

  if (!partId) {
    instrument = new THREE.Group();
    addMesh(instrument, new THREE.BoxGeometry(d * 0.3, 0.15, d * 0.3), MATS.metalMid, 0, h / 2 + 0.08, 0);
  } else if (partId.includes('camera')) {
    instrument = makeCameraModule(h, d, partId.includes('hires'));
  } else if (partId.includes('spectrometer')) {
    instrument = makeSpectrometerModule(h, d);
  } else if (partId.includes('radar')) {
    instrument = makeRadarModule(h, d);
  } else if (partId.includes('magnetometer')) {
    instrument = makeMagnetometerModule(h, d);
  } else if (partId.includes('drill')) {
    instrument = makeDrillModule(h, d);
  } else if (partId.includes('rover') || partId.includes('swarm')) {
    instrument = partId.includes('swarm')
      ? makeMicroRoverModule(h, d)
      : makeRoverModule(h, d);
  } else if (partId.includes('sample_return')) {
    instrument = makeSampleReturnModule(h, d);
  } else if (partId.includes('astrobiology')) {
    instrument = makeAstrobiologyModule(h, d);
  } else if (partId.includes('lidar')) {
    instrument = makeLidarModule(h, d);
  } else if (partId.includes('ice_mapper')) {
    instrument = makeIceMapperModule(h, d);
  } else if (partId.includes('weather')) {
    instrument = makeWeatherModule(h, d);
  } else if (partId.includes('seismometer')) {
    instrument = makeSeismometerModule(h, d);
  } else if (partId.includes('atmospheric')) {
    instrument = makeAtmosphericSamplerModule(h, d);
  } else if (partId.includes('xray')) {
    instrument = makeXrayModule(h, d);
  } else if (partId.includes('neutron')) {
    instrument = makeNeutronModule(h, d);
  } else {
    instrument = new THREE.Group();
    addMesh(instrument, new THREE.BoxGeometry(d * 0.5, h * 0.35, d * 0.5), MATS.metalMid, 0, h / 2 - 0.1, 0);
    addPanelLine(instrument, -d * 0.25, h / 2 - 0.1, d * 0.25, h / 2 - 0.1, d * 0.25 + 0.005);
  }

  if (instrument) content.add(instrument);

  // ---- Measure the assembled payload ----
  content.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(content);
  let size = box.getSize(new THREE.Vector3());

  // Target bounds — with a small safety margin
  const maxH = h * 0.98;
  const maxW = d * 0.98;

  // Only shrink, never grow
  const scaleY = size.y > maxH ? maxH / size.y : 1;
  const scaleXZ = Math.max(size.x, size.z) > maxW ? maxW / Math.max(size.x, size.z) : 1;
  const s = Math.min(scaleY, scaleXZ, 1);

  content.scale.setScalar(s);

  // ---- Recenter so the payload sits centered inside the slot ----
  content.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(content);

  // Align the bottom of the payload to the bottom of the segment (-h/2)
  content.position.y = -h / 2 - box.min.y;
  // Center horizontally in the segment
  const center = box.getCenter(new THREE.Vector3());
  content.position.x = -center.x;
  content.position.z = -center.z;

  return outer;
}

// =========================================================
// NOSE CONE (unchanged)
// =========================================================
export function makeNoseCone(h, d, partId) {
  const g = new THREE.Group();
  const isBlunt = partId && partId.includes('blunt');
  const isAeroshell = partId && partId.includes('aeroshell');
  const mat = isAeroshell ? MATS.noseAblative : MATS.nose;

  const points = [];
  const steps = 32;

  if (partId && partId.includes('biconic')) {
    const midT = 0.5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      let r;
      if (t < midT) r = (d / 2) * (1 - t / midT * 0.5);
      else r = (d / 2) * 0.5 * (1 - (t - midT) / (1 - midT));
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else if (partId && partId.includes('parabolic')) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      const r = (d / 2) * Math.sqrt(1 - t * t);
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else if (partId && partId.includes('ogive')) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      const r = (d / 2) * Math.sqrt(1 - t * t * 0.95);
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else if (isBlunt) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      let r = (d / 2) * Math.pow(1 - t * t * 0.98, 0.5);
      if (t > 0.95) r = (d / 2) * 0.1;
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else if (isAeroshell) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      const r = (d / 2) * Math.sin(Math.PI * (1 - t) * 0.7);
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  } else {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      const power = partId && partId.includes('von_karman') ? 0.5 : 0.6;
      const r = (d / 2) * Math.pow(1 - t, power);
      points.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
  }

  const latheGeo = new THREE.LatheGeometry(points, 64);
  g.add(new THREE.Mesh(latheGeo, mat));

  const ring = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.03, 8, 48), MATS.metalMid);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -h / 2 + 0.02;
  g.add(ring);

  if (isAeroshell) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 * 1.02, d / 2 * 1.02, 0.05, 48), MATS.noseAblative);
    plate.position.y = -h / 2 + 0.06;
    g.add(plate);
  }

  return g;
}

// =========================================================
// FLAME
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

// =========================================================
// DISPATCHER
// =========================================================
export function buildDetailedPart(part, slotShape) {
  const h = slotShape.h;
  const d = slotShape.d;
  const id = part ? part.id : null;
  const slot = part?.slot;

  switch (slot) {
    case 'engine_cluster':
      if (id && id.includes('_small'))     return makeEngineCluster(h, d, 'three');
      if (id && id.includes('single'))     return makeEngineCluster(h, d, 'one');
      if (id && id.includes('rs25'))       return makeEngineCluster(h, d, 'four');
      if (id && id.includes('rd180'))      return makeEngineCluster(h, d, 'two');
      if (id && id.includes('be4'))        return makeEngineCluster(h, d, 'two');
      if (id && id.includes('raptor'))     return makeEngineCluster(h, d, 'three');
      if (id && id.includes('methalox_5')) return makeEngineCluster(h, d, 'five');
      if (id && id.includes('hypergolic')) return makeEngineCluster(h, d, 'four');
      if (id && id.includes('aerospike'))  return makeEngineCluster(h, d, 'two');
      if (id && id.includes('solid'))      return makeEngineCluster(h, d, 'four');
      if (id && id.includes('nuclear'))    return makeEngineCluster(h, d, 'three');
      return makeEngineCluster(h, d, 'nine');
    case 'thrust_structure':  return makeThrustStructure(h, d);
    case 'oxidizer_tank':
      if (id && id.includes('n2o4'))   return makeTank(h, d, MATS.storable, 'cryo');
      if (id && id.includes('h2o2'))   return makeTank(h, d, MATS.metalLight, 'standard');
      if (id && id.includes('n2o'))    return makeTank(h, d, MATS.metalLight, 'standard');
      if (id && id.includes('mixed'))  return makeTank(h, d, MATS.storable, 'standard');
      return makeTank(h, d, MATS.lox, 'cryo');
    case 'fuel_tank':
      if (id && id.includes('ch4'))      return makeTank(h, d, MATS.methane, 'cryo');
      if (id && id.includes('lh2'))      return makeTank(h, d, MATS.metalLight, 'cryo');
      if (id && id.includes('storable')) return makeTank(h, d, MATS.storable, 'standard');
      if (id && id.includes('stainless')) return makeTank(h, d, MATS.silver, 'standard');
      if (id && id.includes('rp1'))      return makeTank(h, d, MATS.gold, 'standard');
      return makeTank(h, d, MATS.gold, 'standard');
    case 'intertank':         return makeIntertank(h, d);
    case 'pressurant':
      if (id && id.includes('auto'))         return makePressurant(h, d, 'autogenous');
      if (id && id.includes('regenerative')) return makePressurant(h, d, 'regenerative');
      if (id && id.includes('nitrogen'))     return makePressurant(h, d, 'nitrogen');
      return makePressurant(h, d, 'standard');
    case 'grid_fins':         return makeGridFins(h, d);
    case 'interstage':        return makeInterstage(h, d);
    case 'separation':        return makeSeparation(h, d);
    case 'upper_engine':      return makeUpperEngine(h, d);
    case 'upper_tank':        return makeTank(h, d, MATS.metalLight, 'cryo');
    case 'avionics':          return makeAvionics(h, d, id);
    case 'power':             return makePower(h, d, id);
    case 'payload':           return makePayload(h, d, id);
    case 'nose_cone':         return makeNoseCone(h, d, id);
    default:                  return null;
  }
}