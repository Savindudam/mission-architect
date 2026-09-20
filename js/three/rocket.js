import * as THREE from 'three';

const SLOT_ORDER = [
  'engine_cluster',
  'thrust_structure',
  'oxidizer_tank',
  'fuel_tank',
  'intertank',
  'pressurant',
  'grid_fins',
  'interstage',
  'separation',
  'upper_engine',
  'upper_tank',
  'avionics',
  'power',
  'payload',
  'nose_cone',
];

// Every slot has ONE fixed visual shape. Both the empty outline and the
// installed part use this exact geometry, so the part snaps into the
// outline's footprint with no size shift.
const SLOT_SHAPE = {
  engine_cluster:   { h: 2.4, d: 1.7, type: 'cylinder' },
  thrust_structure: { h: 0.7, d: 1.9, type: 'frustum' },
  oxidizer_tank:    { h: 7.0, d: 1.7, type: 'cylinder' },
  fuel_tank:        { h: 7.5, d: 1.7, type: 'cylinder' },
  intertank:        { h: 1.4, d: 1.7, type: 'cylinder' },
  pressurant:       { h: 0.6, d: 1.9, type: 'cylinder' },
  grid_fins:        { h: 0.5, d: 2.2, type: 'cylinder' },
  interstage:       { h: 1.8, d: 1.6, type: 'cylinder' },
  separation:       { h: 0.3, d: 1.6, type: 'cylinder' },
  upper_engine:     { h: 1.8, d: 1.2, type: 'cone' },
  upper_tank:       { h: 3.4, d: 1.5, type: 'cylinder' },
  avionics:         { h: 0.6, d: 1.3, type: 'cylinder' },
  power:            { h: 0.6, d: 1.5, type: 'cylinder' },
  payload:          { h: 0.9, d: 1.3, type: 'cylinder' },
  nose_cone:        { h: 1.8, d: 1.3, type: 'cone' },
};

// Bright saturated colours per slot. This is the fill colour when a part
// is installed. Instantly readable from across the room.
const SLOT_COLOR = {
  engine_cluster:   0x1f1f2a,  // near-black gunmetal
  thrust_structure: 0x6e6e7c,  // steel grey
  oxidizer_tank:    0x3fb5ff,  // LOX blue
  fuel_tank:        0xffc23a,  // warm gold
  intertank:        0x8c8c9a,  // light steel
  pressurant:       0xb4b4c0,  // pale grey
  grid_fins:        0x2a2a34,  // dark titanium
  interstage:       0xd4d4dc,  // pale grey
  separation:       0xffd23a,  // pyrotechnic yellow
  upper_engine:     0x1f1f2a,  // same dark gunmetal
  upper_tank:       0xe8ecf0,  // bright silver
  avionics:         0x2472ff,  // computing blue
  power:            0xffcc22,  // solar gold
  payload:          0xff5522,  // science orange
  nose_cone:        0xf0f0f4,  // near white
};

function geometryFor(type, h, d) {
  switch (type) {
    case 'cone':    return new THREE.ConeGeometry(d / 2, h, 32);
    case 'box':     return new THREE.BoxGeometry(d, h, d);
    case 'frustum': return new THREE.CylinderGeometry((d / 2) * 0.78, d / 2, h, 32);
    default:        return new THREE.CylinderGeometry(d / 2, d / 2, h, 32);
  }
}

// ---------- EMPTY SLOT ----------
// Cyan wireframe cage over a faint dark fill. Clearly reads as "nothing here".
function makePlaceholderMesh(slot) {
  const shape = SLOT_SHAPE[slot] || { h: 1, d: 1, type: 'cylinder' };
  const geo = geometryFor(shape.type, shape.h, shape.d);

  const group = new THREE.Group();

  // Dark translucent fill so the silhouette exists
  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0x0c0c18,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
  );
  group.add(fill);

  // Cyan wireframe outline
  const edges = new THREE.EdgesGeometry(geo, 1);
  const outline = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.75,
    })
  );
  group.add(outline);

  group.userData.slot = slot;
  group.userData.height = shape.h;
  group.userData.diameter = shape.d;
  group.userData.isPlaceholder = true;
  return group;
}

// ---------- INSTALLED PART ----------
// Solid coloured shape. SAME geometry as the slot outline — so it visually
// snaps into the empty slot's footprint with no size shift.
// No wireframe. No transparency. No metalness black-hole.
function makePartMesh(part) {
  const shape = SLOT_SHAPE[part.slot] || { h: 1, d: 1, type: 'cylinder' };
  const geo = geometryFor(shape.type, shape.h, shape.d);

  const color = SLOT_COLOR[part.slot] || 0xcccccc;

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.05,
    roughness: 0.55,
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
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
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

    const part = installedBySlot[slot];

    // Slot geometry is identical in both branches. The only difference is
    // the visual: wireframe outline when empty, solid coloured mesh when
    // filled.
    const slotMesh = part ? makePartMesh(part) : makePlaceholderMesh(slot);

    const h = slotMesh.userData.height;
    const d = slotMesh.userData.diameter;

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