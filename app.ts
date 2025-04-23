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
  // Number of red boxes (presents) to spawn (reduced for more scarcity)
  const boxCount = 8;
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
  const failReasonElement = document.getElementById('failReason')!;
  let highScore = 0;
  try {
    highScore = parseInt(localStorage.getItem('highScore') || '0', 10) || 0;
  } catch {
    highScore = 0;
  }
  highScoreElement.innerText = `High Score: ${highScore}`;
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

  // Create a present: red box with yellow ribbon cross
  function createPresent() {
    const group = new THREE.Group();
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({ color: 0xff0000 })
    );
    boxMesh.position.y = 0.5;
    group.add(boxMesh);
    const ribbonMat = new THREE.MeshPhongMaterial({ color: 0xFFFF00 });
    // Ribbon along X-axis
    const ribbonX = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.1, 0.1),
      ribbonMat
    );
    ribbonX.position.set(0, 0.5, 0);
    group.add(ribbonX);
    // Ribbon along Z-axis
    const ribbonZ = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 1.2),
      ribbonMat
    );
    ribbonZ.position.set(0, 0.5, 0);
    group.add(ribbonZ);
    return group;
  }
  // Create a ski gate: two flags marking a gate the player must pass through
  function createGate() {
    // Determine gate center X randomly within lane bounds
    const halfWidth = gateWidth / 2;
    const centerX = THREE.MathUtils.randFloatSpread((laneWidth - halfWidth) * 2);
    const leftX = centerX - halfWidth;
    const rightX = centerX + halfWidth;
    const group = new THREE.Group();
    // Store gate data
    group.userData = { leftX, rightX, passed: false };
    // Pole material
    const poleMat = new THREE.MeshPhongMaterial({ color: 0x654321 });
    const poleGeo = new THREE.CylinderGeometry(gatePoleRadius, gatePoleRadius, gatePoleHeight);
    // Left pole
    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.position.set(leftX, gatePoleHeight / 2, 0);
    group.add(leftPole);
    // Right pole
    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.position.set(rightX, gatePoleHeight / 2, 0);
    group.add(rightPole);
    // Flags
    const flagGeo = new THREE.PlaneGeometry(gateFlagSize, gateFlagSize);
    // Left flag (bright pink)
    const leftFlag = new THREE.Mesh(flagGeo, new THREE.MeshPhongMaterial({ color: 0xFF1493, side: THREE.DoubleSide }));
    leftFlag.position.set(leftX + gatePoleRadius + 0.01, gatePoleHeight * 0.75, 0);
    group.add(leftFlag);
    // Right flag (bright violet)
    const rightFlag = new THREE.Mesh(flagGeo, new THREE.MeshPhongMaterial({ color: 0x9400D3, side: THREE.DoubleSide }));
    rightFlag.position.set(rightX - gatePoleRadius - 0.01, gatePoleHeight * 0.75, 0);
    group.add(rightFlag);
    return group;
  }
  // Create a snowman: two spheres (body and head)
  function createSnowman() {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), mat);
    body.position.y = 1;
    group.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), mat);
    head.position.y = 1 + 1 + 0.7;
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
    // Advance total distance to manage gate spawning
    totalDistance += currentSpeed * dt;
    // Spawn a new ski gate at intervals
    if (totalDistance - lastGateDistance >= gateSpacing) {
      lastGateDistance += gateSpacing;
      const gate = createGate();
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
          playGateSuccessSound();
        }
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
              console.log('[DEBUG] showHighScoresBoard: about to set hsName in localStorage. Old:', localStorage.getItem('hsName'), 'New:', name);
              localStorage.setItem('hsName', name);
              console.log('[DEBUG] showHighScoresBoard: localStorage hsName now:', localStorage.getItem('hsName'));
              console.log('[DEBUG] showHighScoresBoard: localStorage hsName now:', localStorage.getItem('hsName'));
              const postResp = await fetch('/api/high-scores', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': process.env.HIGH_SCORES_TOKEN || ''
                },
                body: JSON.stringify({ name, score: finalScore }),
              });
              if (!postResp.ok) throw new Error(`HTTP ${postResp.status}`);
              scores = await postResp.json();
              renderScoresTable(container, scores);
              input.disabled = true;
              submitBtn.disabled = true;
            } catch (err) {
              alert('Failed to save score');
            }
          });
        } else {
          // Returning player: auto-submit new high score
          const info = document.createElement('div');
          info.innerText = `Submitting your score as ${storedName}`;
          container.appendChild(info);
          try {
            const postResp = await fetch('/api/high-scores', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.HIGH_SCORES_TOKEN || ''
              },
              body: JSON.stringify({ name: storedName, score: finalScore }),
            });
            if (!postResp.ok) throw new Error(`HTTP ${postResp.status}`);
            scores = await postResp.json();
          } catch (err) {
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
  function renderScoresTable(container: HTMLElement, scores: Array<{name: string, score: number}>) {
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
    ['Rank', 'Name', 'Score'].forEach(text => {
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
    // Reset tree density and gates
    treePool.forEach(tree => scene.remove(tree));
    treePool.length = 0;
    lastDensityIncrease = 0;
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