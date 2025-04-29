declare const THREE: any;

 (function() {
  let scene: any, camera: any, renderer: any;
  // Number of trees to display in the forest (initially sparse)
  const treeCount = 20;
  // Maximum number of trees as density increases
  const maxTreeCount = 150;
  // Number of trees to add at each level gate
  let treesPerInterval = 1;
  // Amount to increase treesPerInterval at each level gate
  const TREES_PER_INTERVAL_INCREMENT = 1;
  // Number of red boxes (presents) to spawn (reduced for more scarcity)
  const boxCount = 8;
  // Horizontal half-width of the forest (player X range and spawn zone half-width)
  // Increased for a much wider forest
  const laneWidth = 50;
  // Range along Z-axis where trees and boxes spawn (further range = larger area)
  const spawnMinZ = 200;
  const spawnMaxZ = 400;
  // Base forward speed (units per second), decreased by 20% (from 50 to 40)
  const START_SPEED = 50;
  let currentSpeed = START_SPEED;
  // Difficulty bumps per level gate: increase speed and spawn more trees
  const SPEED_LEVEL_INCREMENT = 2;
  // Snow particle system settings
  const snowCount = 1000;
  const snowFallSpeed = 20;
  let snowParticles: any;
  // Ski gate settings
  // Distance between gates along Z-axis (smaller = more frequent)
  const gateSpacing = 200;        // was 300, now more common
  const gateSpawnOffset = 50;     // additional Z-offset beyond spawnMaxZ
  const gateWidth = 15;          // horizontal width between flags
  const gatePoleHeight = 4;
  const gatePoleRadius = 0.1;
  const gateFlagSize = 1;
  let totalDistance = 0;
  let lastGateDistance = 0;
  const gatePool: any[] = [];
  // Snowman settings
  const snowmanInterval = 15;     // seconds between snowmen
  let lastSnowmanTime = 0;
  const snowmanPool: any[] = [];
  // Barrier settings
  const barrierThickness = 1;
  const barrierHeight = 2;
  const barrierSegmentLength = 20;
  const barrierCountPerSide = 10;
  const barrierTextChance = 0.3;
  let barrierPool: any[] = [];
  // Level tracking for course progression
  let level = 1;
  let gatesSpawned = 0;
  let playerX = 0;
  let playerVx = 0;
  const playerSpeed = 20;
  // Gamepad state
  let gamepadIndex: number | null = null;
  // Deadzone for analog stick to ignore small drift
  const GAMEPAD_DEADZONE = 0.15;

  let lastTime = performance.now();
  let timeAlive = 0;
  let bonusPoints = 0;
  let gameOver = false;

  const scoreElement = document.getElementById('score')!;
  const gameOverElement = document.getElementById('gameOver')!;
  const restartButton = document.getElementById('restartButton')!;
  // High score display element and persisted value
  const highScoreElement = document.getElementById('highScore')!;
  const failReasonElement = document.getElementById('failReason')!;
  let highScore = 0;
  try {
    highScore = parseInt(localStorage.getItem('highScore') || '0', 10) || 0;
  } catch {
    highScore = 0;
  }
  highScoreElement.innerText = `High Score: ${highScore}`;
  // Level display element
  const levelElement = document.getElementById('level')!;
  levelElement.innerText = `Level: ${level}`;
  // Audio context and success sound for collecting boxes
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  // Play a 'katching' sound when collecting a present
  function playKatchSound() {
    const t0 = audioCtx.currentTime;
    // First tone
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(800, t0);
    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.2, t0);
    gain1.gain.exponentialRampToValueAtTime(0.01, t0 + 0.1);
    osc1.connect(gain1).connect(audioCtx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.1);
    // Second tone
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, t0 + 0.1);
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.2, t0 + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, t0 + 0.2);
    osc2.connect(gain2).connect(audioCtx.destination);
    osc2.start(t0 + 0.1);
    osc2.stop(t0 + 0.2);
  }
  // Play a crash sound: low thud plus high-pitched white noise
  function playCrashSound() {
    const t0 = audioCtx.currentTime;
    // Low-frequency thud
    const thudOsc = audioCtx.createOscillator();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(60, t0);
    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0.5, t0);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3);
    thudOsc.connect(thudGain).connect(audioCtx.destination);
    thudOsc.start(t0);
    thudOsc.stop(t0 + 0.3);
    // High-frequency white noise
    const duration = 0.2;
    const sampleRate = audioCtx.sampleRate;
    const bufferSize = sampleRate * duration;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t0 + duration);
    noiseSource.connect(noiseGain).connect(audioCtx.destination);
    noiseSource.start(t0);
    noiseSource.stop(t0 + duration);
  }
  // Play a two-tone rising sound when passing a gate
  function playGateSuccessSound() {
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    const startFreq = 400;
    const endFreq = 800;
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.linearRampToValueAtTime(endFreq, t0 + 0.3);
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.2, t0);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3);
    osc.connect(gainNode).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  const treePool: any[] = [];
  const boxPool: any[] = [];

  function init() {
    scene = new THREE.Scene();
    // Snowy ground: use white ground material and light blue sky
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);
    // Face forward along positive Z (trees spawn at positive Z)
    camera.lookAt(new THREE.Vector3(0, 2, 1));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('view3d')!.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);

    // ------------------------------------------------------------------
    // Lighting
    // ------------------------------------------------------------------
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // Key directional light – place it behind the player (−Z) and
    // slightly to the right (+X) at an elevated Y so that objects in
    // front of the player are lit and cast longish shadows **towards**
    // the camera.
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    // Raise Y to shorten shadows (higher sun angle)
    dir.position.set(15, 40, -20);
    // Aim the light down-the-slope (positive Z-direction)
    dir.target.position.set(0, 0, 50);
    scene.add(dir.target);

    // Enable shadows from this light
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    // Widen the orthographic shadow camera so it covers the course
    const shadowCamSize = laneWidth * 2;
    (dir.shadow.camera as any).left = -shadowCamSize;
    (dir.shadow.camera as any).right = shadowCamSize;
    (dir.shadow.camera as any).top = shadowCamSize;
    (dir.shadow.camera as any).bottom = -shadowCamSize;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = spawnMaxZ + 100;
    dir.shadow.bias = -0.0005;
    scene.add(dir);

    const groundGeo = new THREE.PlaneGeometry(2000, 2000, 8, 8);
    // White ground for snow
    // Almost pure-white snow ground
    const groundMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, shininess: 2 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    for (let i = 0; i < treeCount; i++) {
      const tree = createTree();
      resetTree(tree);
      scene.add(tree);
      treePool.push(tree);
    }

    // Create presents (boxes) with ribbons
    for (let i = 0; i < boxCount; i++) {
      const box = createPresent();
      resetBox(box);
      scene.add(box);
      box.userData.active = true;
      boxPool.push(box);
    }
    // Create snow particle system
    const snowGeometry = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[3 * i] = THREE.MathUtils.randFloatSpread(laneWidth * 2);
      snowPositions[3 * i + 1] = THREE.MathUtils.randFloat(10, 50);
      snowPositions[3 * i + 2] = THREE.MathUtils.randFloat(-10, spawnMaxZ);
    }
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.5, transparent: true, opacity: 0.8 });
    snowParticles = new THREE.Points(snowGeometry, snowMaterial);
    scene.add(snowParticles);
    // Initialize barrier segments on both sides
    for (let i = 0; i < barrierCountPerSide; i++) {
      const leftBarrier = createBarrierSegment('left');
      scene.add(leftBarrier);
      barrierPool.push(leftBarrier);
      const rightBarrier = createBarrierSegment('right');
      scene.add(rightBarrier);
      barrierPool.push(rightBarrier);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    // Mobile touch controls: tap left/right half of screen
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchStart, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    // Gamepad connection events
    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      // Prefer the first connected gamepad, but allow re-selection on reconnect
      if (gamepadIndex === null) {
        gamepadIndex = e.gamepad.index;
        console.log(`Gamepad connected at index ${gamepadIndex}: ${e.gamepad.id}`);
      }
    });
    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      if (gamepadIndex === e.gamepad.index) {
        console.log(`Gamepad disconnected from index ${gamepadIndex}: ${e.gamepad.id}`);
        gamepadIndex = null;
      }
    });

    restartButton.addEventListener('click', resetGame);

    animate();
  }

  function createTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 5),
      new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 2.5;
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(2, 4),
      new THREE.MeshPhongMaterial({ color: 0x006400 })
    );
    leaves.position.y = 7;
    leaves.castShadow = true;
    group.add(leaves);
    return group;
  }

  function resetTree(tree: any) {
    tree.position.x = THREE.MathUtils.randFloatSpread(laneWidth * 2);
    tree.position.z = THREE.MathUtils.randFloat(spawnMinZ, spawnMaxZ);
  }

  function resetBox(box: any) {
    box.position.x = THREE.MathUtils.randFloatSpread(laneWidth * 2);
    box.position.z = THREE.MathUtils.randFloat(spawnMinZ, spawnMaxZ);
    box.userData.active = true;
    box.visible = true;
  }
  
  // Generate a canvas texture for barrier segments with optional text
  function makeBarrierTexture(withText: boolean): any {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const w = canvas.width, h = canvas.height;
      const stripeCount = 8;
      const stripeWidth = Math.ceil(w / stripeCount);
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#DDDDDD' : '#87CEEB';
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, h);
      }
      if (withText) {
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const texts = ['Merefield Technology', 'https://merefield.tech'];
        const text = texts[Math.floor(Math.random() * texts.length)];
        ctx.fillText(text, w / 2, h / 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }
  
  // Reset barrier position along Z and X based on side
  function resetBarrier(barrier: any) {
    const offsetX = laneWidth + barrierThickness / 2;
    barrier.position.x = (barrier.userData.side === 'left') ? -offsetX : offsetX;
    barrier.position.z = THREE.MathUtils.randFloat(spawnMinZ, spawnMaxZ);
  }
  
  // Create a barrier segment mesh for given side
  function createBarrierSegment(side: 'left' | 'right'): any {
    const withText = Math.random() < barrierTextChance;
    const texture = makeBarrierTexture(withText);
    const geo = new THREE.BoxGeometry(barrierThickness, barrierHeight, barrierSegmentLength);
    const mat = new THREE.MeshLambertMaterial({ map: texture });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = barrierHeight / 2;
    mesh.castShadow = true;
    mesh.userData.side = side;
    mesh.userData.withText = withText;
    resetBarrier(mesh);
    return mesh;
  }

  // Create a present: red box with yellow ribbon cross
  function createPresent() {
    const group = new THREE.Group();
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color: 0xff0000 })
    );
    boxMesh.position.y = 0.5;
    boxMesh.castShadow = true;
    group.add(boxMesh);
    const ribbonMat = new THREE.MeshPhongMaterial({ color: 0xFFFF00 });
    // Ribbon along X-axis
    const ribbonX = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.1, 0.1),
      ribbonMat
    );
    ribbonX.position.set(0, 0.5, 0);
    ribbonX.castShadow = true;
    group.add(ribbonX);
    // Ribbon along Z-axis
    const ribbonZ = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 1.2),
      ribbonMat
    );
    ribbonZ.position.set(0, 0.5, 0);
    ribbonZ.castShadow = true;
    group.add(ribbonZ);
    return group;
  }
  // Create a ski gate: two flags marking a gate the player must pass through
  function createGate(isLevelGate: boolean = false) {
    // Determine gate center X randomly within lane bounds
    const halfWidth = gateWidth / 2;
    const centerX = THREE.MathUtils.randFloatSpread((laneWidth - halfWidth) * 2);
    const leftX = centerX - halfWidth;
    const rightX = centerX + halfWidth;
    const group = new THREE.Group();
    // Store gate data
    group.userData = { leftX, rightX, passed: false, isLevelGate };
    // Pole material
    const poleMat = new THREE.MeshPhongMaterial({ color: 0x654321 });
    const poleGeo = new THREE.CylinderGeometry(gatePoleRadius, gatePoleRadius, gatePoleHeight);
    // Left pole
    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.position.set(leftX, gatePoleHeight / 2, 0);
    leftPole.castShadow = true;
    group.add(leftPole);
    // Right pole
    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.position.set(rightX, gatePoleHeight / 2, 0);
    rightPole.castShadow = true;
    group.add(rightPole);
    if (isLevelGate) {
      // Banner gate: black banner with text (taller banner, smaller font)
      const bannerHeight = 1.2;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      // Dark blue background for level-completion banners
      ctx.fillStyle = '#00008B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Use smaller font for level banner text
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Alternate banner text on every other level gate
      const levelGateIndex = gatesSpawned / 5;
      const bannerText = (levelGateIndex % 2 === 0)
        ? 'https://merefield.tech'
        : 'Merefield Technology';
      ctx.fillText(bannerText, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const bannerMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const bannerGeo = new THREE.PlaneGeometry(gateWidth, bannerHeight);
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      // Position and orient the banner so the front face faces the camera
      banner.position.set(centerX, gatePoleHeight + bannerHeight / 2, 0);
      banner.rotation.y = Math.PI;
      banner.castShadow = true;
      group.add(banner);
    } else {
      // Flags
      const flagGeo = new THREE.PlaneGeometry(gateFlagSize, gateFlagSize);
      const leftFlag = new THREE.Mesh(flagGeo, new THREE.MeshPhongMaterial({ color: 0xFF1493, side: THREE.DoubleSide }));
      leftFlag.position.set(leftX + gatePoleRadius + 0.01, gatePoleHeight * 0.75, 0);
      leftFlag.castShadow = true;
      group.add(leftFlag);
      const rightFlag = new THREE.Mesh(flagGeo, new THREE.MeshPhongMaterial({ color: 0x9400D3, side: THREE.DoubleSide }));
      rightFlag.position.set(rightX - gatePoleRadius - 0.01, gatePoleHeight * 0.75, 0);
      rightFlag.castShadow = true;
      group.add(rightFlag);
    }
    return group;
  }
  // Create a snowman: two spheres (body and head)
  function createSnowman() {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), mat);
    body.position.y = 1;
    body.castShadow = true;
    group.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), mat);
    head.position.y = 1 + 1 + 0.7;
    head.castShadow = true;
    group.add(head);
    return group;
  }
  // Position the snowman randomly in spawn zone
  function resetSnowman(sm: any) {
    sm.position.x = THREE.MathUtils.randFloatSpread(laneWidth * 2);
    sm.position.z = THREE.MathUtils.randFloat(spawnMinZ, spawnMaxZ);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onKeyDown(e: KeyboardEvent) {
    // Swap arrow keys: left moves towards negative camera-local X (world positive X)
    if (e.key === 'ArrowLeft' || e.key === 'a') playerVx = playerSpeed;
    if (e.key === 'ArrowRight' || e.key === 'd') playerVx = -playerSpeed;
    if ((e.key === ' ' || e.key === 'Enter') && gameOver) resetGame();
  }

  function onKeyUp(e: KeyboardEvent) {
    // Stop movement on key release only if matching direction
    if ((e.key === 'ArrowLeft' || e.key === 'a') && playerVx > 0) playerVx = 0;
    if ((e.key === 'ArrowRight' || e.key === 'd') && playerVx < 0) playerVx = 0;
  }
  // Mobile touch controls: left/right half of screen
  function onTouchStart(e: TouchEvent) {
    // Skip handling (and default blocking) when game is over to allow UI interaction
    if (gameOver) return;
    e.preventDefault();
    const x = e.touches[0].clientX;
    if (x < window.innerWidth / 2) {
      // Left half => ArrowLeft equivalent
      playerVx = playerSpeed;
    } else {
      // Right half => ArrowRight equivalent
      playerVx = -playerSpeed;
    }
  }
  function onTouchEnd(e: TouchEvent) {
    // Skip handling when game is over to allow UI interaction
    if (gameOver) return;
    e.preventDefault();
    playerVx = 0;
  }

  function animate() {
    if (!gameOver) {
      requestAnimationFrame(animate);
    }
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // ------------------------------------------------------------------
    // Gamepad handling (analog steering)
    // ------------------------------------------------------------------
    if (gamepadIndex !== null) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : null;
      const gp = gamepads && gamepads[gamepadIndex];
      if (gp) {
        // Typically left stick horizontal axis is axes[0]
        const axisX = gp.axes[0] || 0;
        const magnitude = Math.abs(axisX);
        if (magnitude > GAMEPAD_DEADZONE) {
          // Scale axis outside the deadzone to full range (optional)
          const sign = axisX > 0 ? 1 : -1;
          const scaled = (magnitude - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE);
          playerVx = -sign * scaled * playerSpeed;
        } else {
          // Within deadzone => no movement from stick (but don't override keyboard-induced velocity)
          // Only clear if the velocity was previously set by gamepad (approx). When keyboard pressed,
          // its velocity is exactly ±playerSpeed. We'll identify gamepad-set velocities as not exactly
          // equal to ±playerSpeed.
          if (Math.abs(playerVx) !== playerSpeed) {
            playerVx = 0;
          }
        }
      }
    }
    // Update snow particle positions (falling effect)
    const posAttr = snowParticles.geometry.attributes.position as any;
    const sp = posAttr.array as Float32Array;
    for (let i = 0; i < snowCount; i++) {
      const idx = 3 * i;
      sp[idx + 1] -= snowFallSpeed * dt;
      if (sp[idx + 1] < 0) {
        sp[idx + 1] = THREE.MathUtils.randFloat(10, 50);
        sp[idx] = THREE.MathUtils.randFloatSpread(laneWidth * 2);
        sp[idx + 2] = THREE.MathUtils.randFloat(-10, spawnMaxZ);
      }
    }
    posAttr.needsUpdate = true;

    playerX += playerVx * dt;
    playerX = THREE.MathUtils.clamp(playerX, -laneWidth, laneWidth);
    camera.position.x = playerX;
    // Keep looking forward along positive Z
    camera.lookAt(new THREE.Vector3(playerX, camera.position.y, camera.position.z + 1));

    for (const tree of treePool) {
      tree.position.z -= currentSpeed * dt;
      if (tree.position.z < -10) {
        resetTree(tree);
      } else {
        const dx = tree.position.x - playerX;
        const dz = tree.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 2) {
          // Collision with tree: play crash sound and end game with reason
          playCrashSound();
          endGame('You hit a tree!');
        }
      }
    }

    for (const box of boxPool) {
      if (!box.userData.active) continue;
      box.position.z -= currentSpeed * dt;
      if (box.position.z < -10) {
        resetBox(box);
      } else {
        const dx = box.position.x - playerX;
        const dz = box.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
          // Collect present: play katch sound
          playKatchSound();
          bonusPoints += 10;
          box.userData.active = false;
          box.visible = false;
        }
      }
    }
    // Move barrier segments
    for (const barrier of barrierPool) {
      barrier.position.z -= currentSpeed * dt;
      if (barrier.position.z < -10) {
        resetBarrier(barrier);
      }
    }

    timeAlive += dt;
    const score = Math.floor(timeAlive) + bonusPoints;
    // Update high score if beaten and provide share link
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('highScore', String(highScore));
      highScoreElement.innerText = `High Score: ${highScore}`;
      // Create or update share link for new high score
      try {
        // Use base game URL for sharing (no querystring)
        const shareUrl = process.env.URL;
        let shareLink = document.getElementById('shareLink') as HTMLAnchorElement | null;
        if (!shareLink) {
          shareLink = document.createElement('a');
          shareLink.id = 'shareLink';
          shareLink.style.display = 'block';
          shareLink.style.marginTop = '8px';
          highScoreElement.parentElement?.insertBefore(shareLink, highScoreElement.nextSibling);
        }
        // Update link URL, target, and display text with current high score
        shareLink.href = shareUrl;
        shareLink.target = '_blank';
        shareLink.innerText = `See if you can beat my high score: ${score}!`;
      } catch {
        // In case process.env.URL is not defined, skip share link
      }
    }
    scoreElement.innerText = `Score: ${score}`;
    // Advance total distance to manage gate spawning
    totalDistance += currentSpeed * dt;
    // Spawn a new ski gate at intervals
    if (totalDistance - lastGateDistance >= gateSpacing) {
      lastGateDistance += gateSpacing;
      gatesSpawned++;
      const isLevelGate = (gatesSpawned % 5 === 0);
      const gate = createGate(isLevelGate);
      gate.position.z = spawnMaxZ + gateSpawnOffset;
      scene.add(gate);
      gatePool.push(gate);
    }
    // Update gates: move, check passage, and remove past gates
    for (let i = 0; i < gatePool.length; i++) {
      const gate = gatePool[i];
      gate.position.z -= currentSpeed * dt;
      // Check if player passes through when gate reaches camera plane
      if (!gate.userData.passed && gate.position.z < 0) {
        const px = playerX;
        if (px < gate.userData.leftX || px > gate.userData.rightX) {
          // Missed the gate: play crash and end game with reason
          playCrashSound();
          endGame('Missed a gate!');
        } else {
          // Successful gate pass
          if (gate.userData.isLevelGate) {
            // Level completion banner gate
            playGateSuccessSound();
            level++;
            levelElement.innerText = `Level: ${level}`;
            // Increase difficulty
            currentSpeed += SPEED_LEVEL_INCREMENT;
            // Increase number of trees to spawn per gate
            treesPerInterval += TREES_PER_INTERVAL_INCREMENT;
            // Spawn new trees for this level gate
            for (let i = 0; i < treesPerInterval && treePool.length < maxTreeCount; i++) {
              const newTree = createTree();
              resetTree(newTree);
              scene.add(newTree);
              treePool.push(newTree);
            }
          } else {
            playGateSuccessSound();
          }
        } // close gate.pass check else-block
        gate.userData.passed = true;
      }
      // Remove gates that have moved past view
      if (gate.position.z < -10) {
        scene.remove(gate);
        gatePool.splice(i, 1);
        i--;
      }
    }

    // Spawn snowmen periodically
    if (timeAlive - lastSnowmanTime >= snowmanInterval) {
      lastSnowmanTime += snowmanInterval;
      const sm = createSnowman();
      resetSnowman(sm);
      scene.add(sm);
      snowmanPool.push(sm);
    }
    // Update snowmen: move, detect collision, and remove
    for (let i = 0; i < snowmanPool.length; i++) {
      const sm = snowmanPool[i];
      sm.position.z -= currentSpeed * dt;
      if (sm.position.z < -10) {
        scene.remove(sm);
        snowmanPool.splice(i, 1);
        i--;
        continue;
      }
      const dx2 = sm.position.x - playerX;
      const dz2 = sm.position.z;
      if (Math.sqrt(dx2 * dx2 + dz2 * dz2) < 1.5) {
        playCrashSound();
        endGame('You hit a snowman!');
      }
    }
    renderer.render(scene, camera);
  }

  /** Trigger game over with optional failure reason */
  function endGame(reason?: string) {
    // Prevent multiple endGame invocations (e.g., multiple collisions)
    if (gameOver) return;
    gameOver = true;
    if (reason) {
      failReasonElement.innerText = reason;
    }
    gameOverElement.classList.remove('hidden');
    // At game end, display server-side high scores
    const finalScore = Math.floor(timeAlive) + bonusPoints;
    showHighScoresBoard(finalScore);
  }

  // Display high scores and handle new top-3 entries
  async function showHighScoresBoard(finalScore: number) {
    // Ensure game-over UI is visible
    gameOverElement.classList.remove('hidden');
    const containerId = 'highScoresBoard';
    let container = document.getElementById(containerId) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.textAlign = 'center';
      container.style.marginTop = '10px';
      gameOverElement.appendChild(container);
    } else {
      container.innerHTML = '';
    }
    try {
      // Fetch existing top-3
      const resp = await fetch('/api/high-scores');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      let scores: Array<{name: string, score: number}> = await resp.json();
      const qualifies = scores.length < 3 || finalScore > scores[scores.length - 1].score;
      // Retrieve stored player name so we only ask once
      const storedName = localStorage.getItem('hsName') || '';
      console.log('[DEBUG] showHighScoresBoard: retrieved hsName from localStorage:', storedName);
      if (qualifies) {
        if (!storedName) {
          // First-time top-3: prompt for name
          const info = document.createElement('div');
          info.innerText = 'Congratulations! You made the top 3. Enter your name:';
          container.appendChild(info);
          const input = document.createElement('input');
          input.type = 'text';
          container.appendChild(input);
          const submitBtn = document.createElement('button');
          submitBtn.innerText = 'Submit';
          container.appendChild(submitBtn);
          submitBtn.addEventListener('click', async () => {
            const name = input.value.trim();
            if (!name) { alert('Please enter a name'); return; }
            try {
              // Store name locally to avoid re-prompting
              console.log('[DEBUG] showHighScoresBoard: about to set hsName in localStorage. Old:', localStorage.getItem('hsName'), 'New:', name);
              localStorage.setItem('hsName', name);
              console.log('[DEBUG] showHighScoresBoard: localStorage hsName now:', localStorage.getItem('hsName'));
              console.log('[DEBUG] showHighScoresBoard: submitting new high score, name:', name, 'score:', finalScore);
              const postResp = await fetch('/api/high-scores', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': process.env.HIGH_SCORES_TOKEN || ''
                },
                body: JSON.stringify({ name, score: finalScore, level }),
              });
              console.log('[DEBUG] showHighScoresBoard: POST response status:', postResp.status);
              if (!postResp.ok) throw new Error(`HTTP ${postResp.status}`);
              scores = await postResp.json();
              console.log('[DEBUG] showHighScoresBoard: updated scores from POST:', scores);
              renderScoresTable(container, scores);
              input.disabled = true;
              submitBtn.disabled = true;
            } catch (err) {
              console.error('[DEBUG] showHighScoresBoard: error saving score:', err);
              alert('Failed to save score');
            }
          });
        } else {
          // Returning player: auto-submit new high score
          const info = document.createElement('div');
          info.innerText = `Submitting your score as ${storedName}`;
          container.appendChild(info);
          try {
            console.log('[DEBUG] showHighScoresBoard: auto-submitting high score, name:', storedName, 'score:', finalScore);
            const postResp = await fetch('/api/high-scores', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.HIGH_SCORES_TOKEN || ''
              },
              body: JSON.stringify({ name: storedName, score: finalScore, level }),
            });
            console.log('[DEBUG] showHighScoresBoard: auto-submit POST response status:', postResp.status);
            if (!postResp.ok) throw new Error(`HTTP ${postResp.status}`);
            scores = await postResp.json();
            console.log('[DEBUG] showHighScoresBoard: auto-submit updated scores:', scores);
          } catch (err) {
            console.error('[DEBUG] showHighScoresBoard: error auto-submitting score:', err);
            alert('Failed to save score');
          }
        }
      }
      // Render the current top-3
      renderScoresTable(container, scores);
    } catch (err) {
      console.error('Error loading high scores:', err);
    }
  }

  // Helper to render scores table
  function renderScoresTable(container: HTMLElement, scores: Array<{name: string, score: number, level?: number}>) {
    let title = container.querySelector('h3');
    if (!title) {
      title = document.createElement('h3');
      title.innerText = 'High Scores';
      container.appendChild(title);
    }
    let table = container.querySelector('table');
    if (table) {
      table.remove();
    }
    table = document.createElement('table');
    table.style.margin = '0 auto';
    // Add table header for clarity
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Rank', 'Name', 'Score', 'Level'].forEach(text => {
      const th = document.createElement('th');
      th.innerText = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    scores.slice(0, 3).forEach((entry, idx) => {
      const tr = document.createElement('tr');
      const rankTd = document.createElement('td'); rankTd.innerText = `#${idx + 1}`;
      const nameTd = document.createElement('td'); nameTd.innerText = entry.name;
      const scoreTd = document.createElement('td'); scoreTd.innerText = String(entry.score);
      tr.appendChild(rankTd);
      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      // Level column
      const levelTd = document.createElement('td'); levelTd.innerText = String((entry as any).level || '');
      tr.appendChild(levelTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function resetGame() {
    gameOver = false;
    timeAlive = 0;
    bonusPoints = 0;
    lastTime = performance.now();
    playerX = 0;
    playerVx = 0;
    gameOverElement.classList.add('hidden');
    // Reset level and difficulty
    level = 1;
    gatesSpawned = 0;
    currentSpeed = START_SPEED;
    levelElement.innerText = `Level: ${level}`;
    // Reset tree density and gates
    treePool.forEach(tree => scene.remove(tree));
    treePool.length = 0;
    for (let i = 0; i < treeCount; i++) {
      const tree = createTree();
      resetTree(tree);
      scene.add(tree);
      treePool.push(tree);
    }
    // Reset presents
    boxPool.forEach(resetBox);
    // Reset gates
    gatePool.forEach(g => scene.remove(g));
    gatePool.length = 0;
    totalDistance = 0;
    lastGateDistance = 0;
    // Reset snowmen
    snowmanPool.forEach(s => scene.remove(s));
    snowmanPool.length = 0;
    lastSnowmanTime = 0;
    // Restart animation loop
    // Clear any previous failure reason
    failReasonElement.innerText = '';
    animate();
  }

  init();
})();