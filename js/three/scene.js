import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(wrap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(18, 12, 28);
  camera.lookAt(0, 10, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  wrap.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 10, 0);
  controls.minDistance = 6;
  controls.maxDistance = 120;
  controls.update();

  // ---- lighting ----
  // Stronger ambient so nothing is fully black
  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambient);

  // Hemisphere light gives a subtle ground/sky tint
  const hemi = new THREE.HemisphereLight(0x88aaff, 0x221a10, 0.5);
  scene.add(hemi);

  // Main key light — bright white from front-right-top
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(20, 40, 20);
  scene.add(key);

  // Fill light — cool blue from back-left
  const fill = new THREE.DirectionalLight(0x88aaff, 0.8);
  fill.position.set(-20, 15, -20);
  scene.add(fill);

  // Rim light — cyan from behind, gives edges a nice glow
  const rim = new THREE.DirectionalLight(0x22d3ee, 1.0);
  rim.position.set(0, 8, -30);
  scene.add(rim);

  // Under glow — warm, bounces off the grid
  const under = new THREE.DirectionalLight(0xff8855, 0.35);
  under.position.set(0, -20, 10);
  scene.add(under);

  // Ground grid
  const grid = new THREE.GridHelper(60, 30, 0x1e1e2a, 0x12121a);
  grid.position.y = -0.05;
  scene.add(grid);

  // Rocket root group
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