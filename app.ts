declare const THREE: any;

(function() {
  let scene: any, camera: any, renderer: any;
  // Number of trees to display in the forest (initially sparse)
  const treeCount = 20;
  // Maximum number of trees as density increases
  const maxTreeCount = 150;
  // Time interval (sec) between adding new trees to increase density
  const densityInterval = 2;  // faster interval for denser forest
  // Number of trees to add each interval
  const treesPerInterval = 2;
  // Track last time density was increased
  let lastDensityIncrease = 0;
  const boxCount = 20;
  // Horizontal half-width of the forest (player X range and spawn zone half-width)
  // Increased for a much wider forest
  const laneWidth = 50;
  // Range along Z-axis where trees and boxes spawn (further range = larger area)
  const spawnMinZ = 200;
  const spawnMaxZ = 400;
  // Base forward speed (units per second)
  const initialSpeed = 50;
  // Rate at which speed increases (units per second per second)
  const speedIncreaseRate = 0.1;
  // Snow particle system settings
  const snowCount = 1000;
  const snowFallSpeed = 20;
  let snowParticles: any;
  let playerX = 0;
  let playerVx = 0;
  const playerSpeed = 20;
  let lastTime = performance.now();
  let timeAlive = 0;
  let bonusPoints = 0;
  let gameOver = false;

  const scoreElement = document.getElementById('score')!;
  const gameOverElement = document.getElementById('gameOver')!;
  const restartButton = document.getElementById('restartButton')!;
  const leftButton = document.getElementById('leftButton')!;
  const rightButton = document.getElementById('rightButton')!;
  // High score display element and persisted value
  const highScoreElement = document.getElementById('highScore')!;
  let highScore = 0;
  try {
    highScore = parseInt(localStorage.getItem('highScore') || '0', 10) || 0;
  } catch {
    highScore = 0;
  }
  highScoreElement.innerText = `High Score: ${highScore}`;
  // Audio context and success sound for collecting boxes
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  function playSuccessSound() {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    osc.connect(gainNode).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  }
  // Play a low thud on tree collision
  function playCrashSound() {
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(60, audioCtx.currentTime);
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    // Quick decay for thud effect
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gainNode).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
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
    document.getElementById('view3d')!.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 10, 10);
    scene.add(dir);

    const groundGeo = new THREE.PlaneGeometry(2000, 2000, 8, 8);
    // White ground for snow
    // Slightly grey snow ground
    const groundMat = new THREE.MeshPhongMaterial({ color: 0xDDDDDD });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    for (let i = 0; i < treeCount; i++) {
      const tree = createTree();
      resetTree(tree);
      scene.add(tree);
      treePool.push(tree);
    }

    for (let i = 0; i < boxCount; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      box.position.y = 0.5;
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

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Swap touch controls: left should move left visually
    leftButton.addEventListener('touchstart', () => { playerVx = playerSpeed; });
    leftButton.addEventListener('touchend', () => { playerVx = 0; });
    rightButton.addEventListener('touchstart', () => { playerVx = -playerSpeed; });
    rightButton.addEventListener('touchend', () => { playerVx = 0; });

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
    group.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(2, 4),
      new THREE.MeshPhongMaterial({ color: 0x006400 })
    );
    leaves.position.y = 7;
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

  function animate() {
    if (!gameOver) {
      requestAnimationFrame(animate);
    }
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    // Compute increasing speed over time
    const currentSpeed = initialSpeed + speedIncreaseRate * timeAlive;
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
          // Collision with tree: play crash sound and end game
          playCrashSound();
          endGame();
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
          // Play success sound on collecting a box
          playSuccessSound();
          bonusPoints += 10;
          box.userData.active = false;
          box.visible = false;
        }
      }
    }

    timeAlive += dt;
    const score = Math.floor(timeAlive) + bonusPoints;
    // Update high score if beaten
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('highScore', String(highScore));
      highScoreElement.innerText = `High Score: ${highScore}`;
    }
    scoreElement.innerText = `Score: ${score}`;
    // Gradually increase tree density over time
    if (timeAlive - lastDensityIncrease >= densityInterval && treePool.length < maxTreeCount) {
      lastDensityIncrease += densityInterval;
      for (let i = 0; i < treesPerInterval && treePool.length < maxTreeCount; i++) {
        const newTree = createTree();
        resetTree(newTree);
        scene.add(newTree);
        treePool.push(newTree);
      }
    }

    renderer.render(scene, camera);
  }

  function endGame() {
    gameOver = true;
    gameOverElement.classList.remove('hidden');
  }

  function resetGame() {
    gameOver = false;
    timeAlive = 0;
    bonusPoints = 0;
    lastTime = performance.now();
    playerX = 0;
    playerVx = 0;
    gameOverElement.classList.add('hidden');
    // Reset tree density: remove existing trees and re-create initial sparse set
    treePool.forEach(tree => scene.remove(tree));
    treePool.length = 0;
    lastDensityIncrease = 0;
    for (let i = 0; i < treeCount; i++) {
      const tree = createTree();
      resetTree(tree);
      scene.add(tree);
      treePool.push(tree);
    }
    boxPool.forEach(resetBox);
    animate();
  }

  init();
})();