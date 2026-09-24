import * as THREE from 'three';

// Shared materials. One set reused by every worker so the whole crowd
// costs almost nothing.

const MAT_HELMET = new THREE.MeshStandardMaterial({ color: 0xffaa22, roughness: 0.55 });
const MAT_VEST   = new THREE.MeshStandardMaterial({ color: 0xff6622, roughness: 0.75 });
const MAT_BODY   = new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.8 });
const MAT_SKIN   = new THREE.MeshStandardMaterial({ color: 0xc8a080, roughness: 0.7 });
const MAT_BOOTS  = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 });
const MAT_STEEL  = new THREE.MeshStandardMaterial({ color: 0x4a4a58, metalness: 0.85, roughness: 0.35 });
const MAT_AMBER  = new THREE.MeshStandardMaterial({ color: 0xffaa22, metalness: 0.7, roughness: 0.4 });

// ---- worker figure, about 1.6 units tall ----
// Legs and arms are groups so they can pivot at hip and shoulder.
function makeWorker() {
  const g = new THREE.Group();

  // torso
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.42, 4, 10),
    MAT_VEST
  );
  torso.position.y = 1.05;
  g.add(torso);

  // neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6),
    MAT_SKIN
  );
  neck.position.y = 1.36;
  g.add(neck);

  // head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    MAT_SKIN
  );
  head.position.y = 1.46;
  g.add(head);

  // helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    MAT_HELMET
  );
  helmet.position.y = 1.49;
  g.add(helmet);

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.018, 14),
    MAT_HELMET
  );
  brim.position.y = 1.43;
  g.add(brim);

  // legs
  const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.68, 6);
  legGeo.translate(0, -0.34, 0);

  const legL = new THREE.Group();
  legL.position.set(-0.07, 0.68, 0);
  legL.add(new THREE.Mesh(legGeo, MAT_BODY));
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.17), MAT_BOOTS);
  bootL.position.set(0, -0.68, 0.02);
  legL.add(bootL);
  g.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.07, 0.68, 0);
  legR.add(new THREE.Mesh(legGeo, MAT_BODY));
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.17), MAT_BOOTS);
  bootR.position.set(0, -0.68, 0.02);
  legR.add(bootR);
  g.add(legR);

  // arms
  const armGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6);
  armGeo.translate(0, -0.275, 0);

  const armL = new THREE.Group();
  armL.position.set(-0.19, 1.25, 0);
  armL.add(new THREE.Mesh(armGeo, MAT_VEST));
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), MAT_SKIN);
  handL.position.y = -0.55;
  armL.add(handL);
  g.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.19, 1.25, 0);
  armR.add(new THREE.Mesh(armGeo, MAT_VEST));
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), MAT_SKIN);
  handR.position.y = -0.55;
  armR.add(handR);
  g.add(armR);

  return { group: g, legL, legR, armL, armR };
}

// ---- warning light on a pole ----
function makeWarningLight(color) {
  const g = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6),
    MAT_STEEL
  );
  pole.position.y = 0.55;
  g.add(pole);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22 })
  );
  body.position.y = 1.15;
  g.add(body);

  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
    })
  );
  lens.position.y = 1.25;
  g.add(lens);

  return { group: g, lens };
}

// ---- gantry crane that spans the pad ----
function makeCrane() {
  const g = new THREE.Group();

  const span = 28;
  const height = 16;

  const legGeo = new THREE.BoxGeometry(0.55, height, 0.55);
  const legL = new THREE.Mesh(legGeo, MAT_STEEL);
  legL.position.set(-span / 2, height / 2, 0);
  g.add(legL);

  const legR = new THREE.Mesh(legGeo, MAT_STEEL);
  legR.position.set(span / 2, height / 2, 0);
  g.add(legR);

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(span + 1.2, 0.7, 0.7),
    MAT_STEEL
  );
  beam.position.y = height;
  g.add(beam);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(span + 2, 0.15, 0.35),
    MAT_STEEL
  );
  rail.position.y = 0.08;
  g.add(rail);

  const trolley = new THREE.Group();
  trolley.position.set(0, height - 0.5, 0);

  const trolleyBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.55, 0.9),
    MAT_AMBER
  );
  trolley.add(trolleyBody);

  // cable pivots at the top so scaling its Y stretches it downward
  const cableGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 4);
  cableGeo.translate(0, -0.5, 0);
  const cable = new THREE.Mesh(cableGeo, MAT_BOOTS);
  cable.position.y = -0.3;
  trolley.add(cable);

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.04, 8, 12, Math.PI * 1.6),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 })
  );
  hook.rotation.z = Math.PI * 0.2;
  trolley.add(hook);

  g.add(trolley);
  g.userData.trolley = trolley;
  g.userData.cable = cable;
  g.userData.hook = hook;
  g.userData.height = height;
  g.userData.span = span;

  return g;
}

// ---- steam puff vent ----
function makeSteamVent(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.1, z);

  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8),
    MAT_STEEL
  );
  nozzle.position.y = 0.15;
  g.add(nozzle);

  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    puff.position.y = 0.5 + i * 0.4;
    puff.userData.delay = i * 0.5;
    g.add(puff);
    puffs.push(puff);
  }

  g.userData.puffs = puffs;
  return g;
}

// ---- public API ----

export function createActivity(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const workers = [];
  const lights = [];
  const vents = [];

  // eight workers walking in slow circles around the pad
  for (let i = 0; i < 8; i++) {
    const w = makeWorker();
    const s = 0.9 + Math.random() * 0.15;
    w.group.scale.setScalar(s);

    w.group.userData = {
      radius: 8 + Math.random() * 6,
      angle: Math.random() * Math.PI * 2,
      centerX: (Math.random() - 0.5) * 4,
      centerZ: (Math.random() - 0.5) * 4,
      speed: (0.15 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
      phase: Math.random() * Math.PI * 2,
    };

    group.add(w.group);
    workers.push(w);
  }

  // six warning lights
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 13 + Math.random() * 2;
    const color = i % 2 === 0 ? 0xff8822 : 0xff3322;
    const l = makeWarningLight(color);
    l.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    l.group.userData = {
      phase: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 1.5,
    };
    group.add(l.group);
    lights.push(l);
  }

  // crane
  const crane = makeCrane();
  crane.position.set(0, 0, -4);
  group.add(crane);

  // two steam vents
  vents.push(makeSteamVent(-10, 6));
  vents.push(makeSteamVent(11, -3));
  for (const v of vents) group.add(v);

  return { group, workers, lights, crane, vents };
}

export function updateActivity(activity, elapsed, dt) {
  if (!activity) return;

  // workers orbit their own small paths
  for (const w of activity.workers) {
    const u = w.group.userData;

    u.angle += u.speed * dt;

    const cx = u.centerX + Math.cos(u.angle) * u.radius;
    const cz = u.centerZ + Math.sin(u.angle) * u.radius;
    const bob = Math.abs(Math.sin(elapsed * 5 + u.phase)) * 0.03;

    w.group.position.set(cx, bob, cz);

    // face the direction of travel. Worker front is +Z, so a
    // counterclockwise path means rotation.y = -angle. Clockwise flips
    // that by 180 degrees.
    const facing = -u.angle + (u.speed > 0 ? 0 : Math.PI);
    w.group.rotation.y = facing;

    const swing = Math.sin(elapsed * 5 + u.phase) * 0.4;
    w.legL.rotation.x = swing;
    w.legR.rotation.x = -swing;
    w.armL.rotation.x = -swing * 0.75;
    w.armR.rotation.x = swing * 0.75;
  }

  // warning lights blink
  for (const l of activity.lights) {
    const u = l.group.userData;
    const blink = (Math.sin(elapsed * u.speed + u.phase) + 1) * 0.5;
    l.lens.material.emissiveIntensity = 0.2 + blink * 1.6;
  }

  // crane trolley slides along the beam, cable extends and retracts
  if (activity.crane) {
    const c = activity.crane;
    const travel = Math.sin(elapsed * 0.25) * (c.userData.span * 0.35);
    c.userData.trolley.position.x = travel;

    const cableLen = 4 + Math.sin(elapsed * 0.4) * 1.5;
    c.userData.cable.scale.y = cableLen;
    c.userData.hook.position.y = -0.3 - cableLen;
  }

  // steam vents pulse outward
  for (const v of activity.vents) {
    for (const puff of v.userData.puffs) {
      const phase = ((elapsed * 0.6 + puff.userData.delay) % 1.6) / 1.6;
      const opacity = phase < 0.3
        ? (phase / 0.3) * 0.35
        : (1 - (phase - 0.3) / 0.7) * 0.35;
      const scale = 0.6 + phase * 1.4;
      puff.material.opacity = Math.max(0, opacity);
      puff.scale.setScalar(scale);
    }
  }
}