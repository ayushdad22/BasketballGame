import * as THREE from 'https://cdn.skypack.dev/three@0.152.0';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es@0.20.0';
const confetti = window.confetti;

let score = 0;
let shots = 0;
let isCharging = false;
let chargePower = 0;
let chargeStartTime = 0;
let isBallInPlay = false;

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

// ---------- Ball ----------
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

let shootAngle = { x: 0, y: 0.5 }; 
let isDragging = false;
let dragStart = new THREE.Vector2();
let arcPoints = [];

const arcLineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00,
    linewidth: 8, 
    transparent: true,
    opacity: 0.8
});

const arcLineGeometry = new THREE.BufferGeometry();
const arcLine = new THREE.Line(arcLineGeometry, arcLineMaterial);
arcLine.visible = false;
scene.add(arcLine);

const tubeMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7
});
const arcTube = new THREE.Mesh(new THREE.TubeGeometry(), tubeMaterial);
arcTube.visible = false;
scene.add(arcTube);

const trailPoints = [];
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
});
const trail = new THREE.Points(trailGeometry, trailMaterial);
trail.visible = false;
scene.add(trail);

const trailParticles = [];
const trailParticleGeometry = new THREE.BufferGeometry();
const trailParticleMaterial = new THREE.PointsMaterial({
    color: 0xff4444,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
});
const trailParticleSystem = new THREE.Points(trailParticleGeometry, trailParticleMaterial);
trailParticleSystem.visible = false;
scene.add(trailParticleSystem);

renderer.domElement.addEventListener('mousedown', (event) => {
    if (isBallInPlay) return;
    
    isDragging = true;
    isCharging = true;
    chargeStartTime = Date.now();
    dragStart.set(event.clientX, event.clientY);
    
    arcLine.visible = true;
    arcTube.visible = true;
    updateArcLine();
});

renderer.domElement.addEventListener('mousemove', (event) => {
    if (!isDragging || isBallInPlay) return;

    const dragEnd = new THREE.Vector2(event.clientX, event.clientY);
    const dragDelta = new THREE.Vector2().subVectors(dragEnd, dragStart); 

    shootAngle.x = dragDelta.x * 0.005; 
    shootAngle.y = Math.max(0.3, Math.min(1.2, 0.5 + dragDelta.y * 0.002)); 
    
    updateArcLine();
});

renderer.domElement.addEventListener('mouseup', shootBall);
renderer.domElement.addEventListener('mouseleave', () => {
    if (isDragging) {
        shootBall();
    }
});

function updateArcLine() {
    const points = [];
    const startPos = new THREE.Vector3(0, 0, 0);
    const power = 8 + chargePower * 12;

    for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const time = t * 3;
        
        const x = startPos.x + Math.sin(shootAngle.x) * power * time;
        const y = startPos.y + Math.sin(shootAngle.y) * power * time - 0.5 * 15 * time * time;
        const z = startPos.z - Math.cos(shootAngle.x) * power * time; 
        
        points.push(new THREE.Vector3(x, y, z));
        
        if (y < -0.5) break;
    }
    
    arcPoints = points;
    
    arcLineGeometry.setFromPoints(points);
    
    if (points.length > 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 50, 0.03, 8, false); // Thick tube
        arcTube.geometry.dispose();
        arcTube.geometry = tubeGeometry;
    }
}

function shootBall() {
    if (!isDragging || isBallInPlay) return;
    
    isDragging = false;
    isCharging = false;
    isBallInPlay = true;
    shots++;
    
    const chargeTime = Date.now() - chargeStartTime;
    chargePower = Math.min(chargeTime / 1000, 1.5);
    
    const power = 8 + chargePower * 12;
    
    ballBody.position.set(0, 1, 0);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    
    const velocity = new CANNON.Vec3(
        Math.sin(shootAngle.x) * power,
        Math.sin(shootAngle.y) * power,
        -Math.cos(shootAngle.x) * power  
    );
    ballBody.velocity = velocity;
    
    arcLine.visible = false;
    arcTube.visible = false;
    trail.visible = true;
    trailParticleSystem.visible = true;
    
    trailPoints.length = 0;
    trailParticles.length = 0;
    
    updateUI();
}

function createTestScoreButton() {
    const button = document.createElement('button');
    button.textContent = 'TEST SCORE';
    button.style.position = 'absolute';
    button.style.top = '130px';
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
        
        arcLine.visible = false;
        arcTube.visible = false;
        trail.visible = true;
        trailParticleSystem.visible = true;
        trailPoints.length = 0;
        trailParticles.length = 0;
        updateUI();
    });
    
    document.body.appendChild(button);
}

function createResetButton() {
    const button = document.createElement('button');
    button.textContent = 'RESET BALL';
    button.style.position = 'absolute';
    button.style.top = '130px';
    button.style.right = '20px';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#f50a3d';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = 'bold';
    button.style.zIndex = '1000';
    
    button.addEventListener('click', () => {
        resetBall();
    });
    
    document.body.appendChild(button);
}

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
        
        rimLight.intensity = 5;
        setTimeout(() => { rimLight.intensity = 1; }, 300);
        
        updateUI();
    }
});

function updateUI() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('shots').textContent = `Shots: ${shots}`;
    document.getElementById('power').textContent = `Power: ${Math.round((chargePower / 1.5) * 100)}%`;
}

function resetBall() {
    isBallInPlay = false;
    scored = false;
    chargePower = 0;
    shootAngle = { x: 0, y: 0.5 };
    
    ballBody.position.set(0, 1, 0);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    
    trail.visible = false;
    trailParticleSystem.visible = false;
    trailPoints.length = 0;
    trailParticles.length = 0;
    arcLine.visible = true;
    arcTube.visible = true;
    updateArcLine();
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    world.step(1 / 60, delta, 3);

    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    if (isCharging) {
        chargePower = Math.min((Date.now() - chargeStartTime) / 1000, 1.5);
        updateArcLine();
        updateUI();
    }

    if (isBallInPlay && trail.visible) {
        trailPoints.push(ballMesh.position.clone());
        if (trailPoints.length > 40) {
            trailPoints.shift();
        }
        trailGeometry.setFromPoints(trailPoints);
        
        trailParticles.push({
            position: ballMesh.position.clone(),
            life: 1.0
        });
        
        const particlePositions = [];
        for (let i = trailParticles.length - 1; i >= 0; i--) {
            trailParticles[i].life -= delta * 2;
            if (trailParticles[i].life <= 0) {
                trailParticles.splice(i, 1);
            } else {
                particlePositions.push(trailParticles[i].position.x, trailParticles[i].position.y, trailParticles[i].position.z);
            }
        }
        
        trailParticleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    }

    if (ballBody.position.y < -2 || 
        Math.abs(ballBody.position.x) > 6 || 
        Math.abs(ballBody.position.z) > 8) {
        resetBall();
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

createTestScoreButton();
createResetButton();
updateUI();
resetBall(); 
animate();