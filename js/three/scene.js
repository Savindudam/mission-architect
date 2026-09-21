import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function makeEnvMap(renderer) {
  // Draw a fake sky into a canvas: dark gradient top to bottom with a bright
  // key-light hotspot. Then convert it to an equirectangular env map so
  // every PBR material reflects it.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, '#10101c');
  grad.addColorStop(0.35, '#0a0a14');
  grad.addColorStop(0.5, '#1a1a2a');
  grad.addColorStop(0.65, '#0a0a14');
  grad.addColorStop(1.0, '#050508');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Key hotspot (bright white-blue) at upper-left
  const spot1 = ctx.createRadialGradient(280, 100, 0, 280, 100, 180);
  spot1.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  spot1.addColorStop(0.4, 'rgba(200, 220, 255, 0.35)');
  spot1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot1;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cyan rim light from the right
  const spot2 = ctx.createRadialGradient(850, 200, 0, 850, 200, 220);
  spot2.addColorStop(0, 'rgba(80, 220, 255, 0.55)');
  spot2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Warm bounce from below
  const spot3 = ctx.createRadialGradient(512, 480, 0, 512, 480, 200);
  spot3.addColorStop(0, 'rgba(255, 140, 60, 0.35)');
  spot3.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot3;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(tex);
  const envMap = envRT.texture;
  pmrem.dispose();
  tex.dispose();

  return envMap;
}

export function createScene(wrap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(18, 12, 28);
  camera.lookAt(0, 10, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);

  // Environment map — makes all PBR metals look real
  scene.environment = makeEnvMap(renderer);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 10, 0);
  controls.minDistance = 6;
  controls.maxDistance = 120;
  controls.update();

  // Lighting — the env map handles reflections; these add shaped direction
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x88aaff, 0x221a10, 0.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(20, 40, 20);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88aaff, 0.6);
  fill.position.set(-20, 15, -20);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x22d3ee, 1.2);
  rim.position.set(0, 8, -30);
  scene.add(rim);

  const under = new THREE.DirectionalLight(0xff8855, 0.4);
  under.position.set(0, -20, 10);
  scene.add(under);

  // Ground grid
  const grid = new THREE.GridHelper(60, 30, 0x1e1e2a, 0x12121a);
  grid.position.y = -0.05;
  scene.add(grid);

  const rocketGroup = new THREE.Group();
  scene.add(rocketGroup);

  function resize() {
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);

  let running = true;
  function tick() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function dispose() {
    running = false;
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  return { scene, camera, renderer, controls, rocketGroup, dispose };
}