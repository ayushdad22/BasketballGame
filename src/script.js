
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import confetti from "canvas-confetti";

let score = 0;
let shots = 0;
let isCharging = false;
let chargePower = 0;
let chargeStartTime = 0;
let isBallInPlay = false;

// ---------- Scene Setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 10, 25);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const world = new CANNON.World();
world.gravity.set(0, -15, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const courtGeometry = new THREE.BoxGeometry(8, 0.1, 15);
const courtMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a2a4a,
  roughness: 0.8,
  metalness: 0.2
});
const courtMesh = new THREE.Mesh(courtGeometry, courtMaterial);
courtMesh.position.y = -0.05;
courtMesh.receiveShadow = true;
scene.add(courtMesh);

const courtBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(4, 0.05, 7.5)),
});
courtBody.position.y = -0.05;
world.addBody(courtBody);

// Court lines
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const lineGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-3, 0.01, 0),
  new THREE.Vector3(3, 0.01, 0)
]);
const centerLine = new THREE.Line(lineGeometry, lineMaterial);
scene.add(centerLine);

const createBasket = () => {
  const basketGroup = new THREE.Group();

  // Backboard
  const backboardGeometry = new THREE.BoxGeometry(1.5, 1, 0.1);
  const backboardMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
  });
  const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
  backboard.position.set(0, 2.5, -5);
  backboard.castShadow = true;
  basketGroup.add(backboard);

  const rimGeometry = new THREE.TorusGeometry(0.4, 0.05, 16, 32);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xff4500 });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.position.set(0, 2, -5);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  basketGroup.add(rim);

  const netGeometry = new THREE.CylinderGeometry(0.4, 0.3, 0.5, 12);
  const netMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.7
  });
  const net = new THREE.Mesh(netGeometry, netMaterial);
  net.position.set(0, 1.75, -5);
  basketGroup.add(net);

  const rimBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Cylinder(0.4, 0.4, 0.1, 12),
  });
  rimBody.position.set(0, 2, -5);
  rimBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
  world.addBody(rimBody);

  const backboardBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(0.75, 0.5, 0.05)),
  });
  backboardBody.position.set(0, 2.5, -5);
  world.addBody(backboardBody);

  return basketGroup;
};

const basket = createBasket();
scene.add(basket);

const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const rimLight = new THREE.PointLight(0xff4500, 1, 10);
rimLight.position.set(0, 2, -5);
scene.add(rimLight);

const ballRadius = 0.2;
const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6b35,
  roughness: 0.3,
  metalness: 0.7
});
const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(ballRadius),
  position: new CANNON.Vec3(0, 1, 0),
  material: new CANNON.Material({ friction: 0.5, restitution: 0.7 })
});
world.addBody(ballBody);

// ---------- Shooting Mechanics ----------
let shootDirection = new THREE.Vector3(0, 0, -1);
let isDragging = false;
let dragStart = new THREE.Vector2();

renderer.domElement.addEventListener('mousedown', (event) => {
  if (isBallInPlay) return;

  isDragging = true;
  isCharging = true;
  chargeStartTime = Date.now();
  dragStart.set(event.clientX, event.clientY);
});

renderer.domElement.addEventListener('mousemove', (event) => {
  if (!isDragging || isBallInPlay) return;

  const dragEnd = new THREE.Vector2(event.clientX, event.clientY);
  const dragDelta = new THREE.Vector2().subVectors(dragStart, dragEnd);

  // Convert mouse movement to shooting direction
  shootDirection.set(-dragDelta.x * 0.01, dragDelta.y * 0.01, -1).normalize();

  updateAimIndicator();
});

renderer.domElement.addEventListener('mouseup', shootBall);
renderer.domElement.addEventListener('mouseleave', () => {
  if (isDragging) {
    shootBall();
  }
});

function shootBall() {
  if (!isDragging || isBallInPlay) return;

  isDragging = false;
  isCharging = false;
  isBallInPlay = true;
  shots++;

  const chargeTime = Date.now() - chargeStartTime;
  chargePower = Math.min(chargeTime / 1000, 1.5); // Max 1.5 seconds charge

  const power = 15 + chargePower * 20; // Base power + charged power

  ballBody.position.set(0, 1, 0);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);

  ballBody.applyImpulse(
    new CANNON.Vec3(
      shootDirection.x * power,
      shootDirection.y * power,
      shootDirection.z * power
    ),
    new CANNON.Vec3(0, 0, 0)
  );

  hideAimIndicator();
  updateUI();
}

const aimIndicator = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 1, 0),
  2,
  0xff0000,
  0.3,
  0.2
);
scene.add(aimIndicator);

function updateAimIndicator() {
  aimIndicator.setDirection(shootDirection.clone().normalize());
  const length = 1 + chargePower * 2;
  aimIndicator.setLength(length, 0.3, 0.2);

  const chargeRatio = chargePower / 1.5;
  const color = new THREE.Color();
  color.setHSL((1 - chargeRatio) * 0.3, 1, 0.5); // Green to red
  aimIndicator.setColor(color);
}

function hideAimIndicator() {
  aimIndicator.visible = false;
}

function showAimIndicator() {
  aimIndicator.visible = true;
  aimIndicator.position.set(0, 1, 0);
}

// ---------- Score Detection ----------
const scoreTrigger = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Sphere(0.3),
  isTrigger: true,
});
scoreTrigger.position.set(0, 1.75, -5);
world.addBody(scoreTrigger);

let scored = false;
scoreTrigger.addEventListener('collide', (event) => {
  if (event.body === ballBody && !scored && isBallInPlay) {
    scored = true;
    score++;

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
    });

    // Rim light flash
    rimLight.intensity = 5;
    setTimeout(() => { rimLight.intensity = 1; }, 300);

    updateUI();
  }
});

// ---------- UI Update ----------
function updateUI() {
  document.getElementById('score').textContent = `Score: ${score}`;
  document.getElementById('shots').textContent = `Shots: ${shots}`;
  document.getElementById('power').textContent = `Power: ${Math.round((chargePower / 1.5) * 100)}%`;
}

function resetBall() {
  isBallInPlay = false;
  scored = false;
  chargePower = 0;
  shootDirection.set(0, 0, -1);
  showAimIndicator();

  ballBody.position.set(0, 1, 0);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  world.step(1 / 60, delta, 3);

  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  if (isCharging) {
    chargePower = Math.min((Date.now() - chargeStartTime) / 1000, 1.5);
    updateAimIndicator();
    updateUI();
  }

  if (ballBody.position.y < -2 ||
    Math.abs(ballBody.position.x) > 6 ||
    Math.abs(ballBody.position.z) > 8) {
    resetBall();
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function createTestScoreButton() {
  const button = document.createElement('button');
  button.textContent = 'TEST SCORE';
  button.style.position = 'absolute';
  button.style.top = '100px';
  button.style.left = '20px';
  button.style.padding = '10px 15px';
  button.style.backgroundColor = '#ff4500';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.fontWeight = 'bold';
  button.style.zIndex = '1000';

  button.addEventListener('click', () => {
    if (isBallInPlay) return;

    isBallInPlay = true;
    shots++;

    ballBody.position.set(0, 3, -4.5);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);

    ballBody.applyImpulse(
      new CANNON.Vec3(0, -2, -1),
      new CANNON.Vec3(0, 0, 0)
    );

    hideAimIndicator();
    updateUI();
  });

  document.body.appendChild(button);
}
createTestScoreButton()
showAimIndicator();
updateUI();
animate();
