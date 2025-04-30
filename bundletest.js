// deps_client.ts
import * as THREE from "https://esm.sh/three@0.128.0";

// app.ts
(function() {
  let scene, camera, renderer;
  const treeCount = 20;
  const maxTreeCount = 150;
  let treesPerInterval = 1;
  const TREES_PER_INTERVAL_INCREMENT = 1;
  const boxCount = 8;
  const laneWidth = 50;
  const spawnMinZ = 200;
  const spawnMaxZ = 400;
  const START_SPEED = 50;
  let currentSpeed = START_SPEED;
  const SPEED_LEVEL_INCREMENT = 2;
  const snowCount = 1e3;
  const snowFallSpeed = 20;
  let snowParticles;
  const gateSpacing = 200;
  const gateSpawnOffset = 50;
  const gateWidth = 15;
  const gatePoleHeight = 4;
  const gatePoleRadius = 0.1;
  const gateFlagSize = 1;
  let totalDistance = 0;
  let lastGateDistance = 0;
  const gatePool = [];
  const snowmanInterval = 15;
  let lastSnowmanTime = 0;
  const snowmanPool = [];
  const barrierThickness = 1;
  const barrierHeight = 2;
  const barrierSegmentLength = 20;
  const barrierCountPerSide = 10;
  const barrierTextChance = 0.3;
  let barrierPool = [];
  let level = 1;
  let gatesSpawned = 0;
  let playerX = 0;
  let playerVx = 0;
  const playerSpeed = 20;
  let gamepadIndex = null;
  const GAMEPAD_DEADZONE = 0.15;
  const GAMEPAD_SPEED_MULTIPLIER = 1.25;
  let lastTime = performance.now();
  let timeAlive = 0;
  let bonusPoints = 0;
  let gameOver = false;
  let prevAButtonPressed = false;
  const scoreElement = document.getElementById("score");
  const gameOverElement = document.getElementById("gameOver");
  const restartButton = document.getElementById("restartButton");
  const highScoreElement = document.getElementById("highScore");
  const failReasonElement = document.getElementById("failReason");
  let highScore = 0;
  try {
    highScore = parseInt(localStorage.getItem("highScore") || "0", 10) || 0;
  } catch {
    highScore = 0;
  }
  highScoreElement.innerText = `High Score: ${highScore}`;
  const levelElement = document.getElementById("level");
  levelElement.innerText = `Level: ${level}`;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playKatchSound() {
    const t0 = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(800, t0);
    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.2, t0);
    gain1.gain.exponentialRampToValueAtTime(0.01, t0 + 0.1);
    osc1.connect(gain1).connect(audioCtx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.1);
    const osc2 = audioCtx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1200, t0 + 0.1);
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.2, t0 + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, t0 + 0.2);
    osc2.connect(gain2).connect(audioCtx.destination);
    osc2.start(t0 + 0.1);
    osc2.stop(t0 + 0.2);
  }
  function playCrashSound() {
    const t0 = audioCtx.currentTime;
    const thudOsc = audioCtx.createOscillator();
    thudOsc.type = "triangle";
    thudOsc.frequency.setValueAtTime(60, t0);
    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0.5, t0);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3);
    thudOsc.connect(thudGain).connect(audioCtx.destination);
    thudOsc.start(t0);
    thudOsc.stop(t0 + 0.3);
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
  function playGateSuccessSound() {
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
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
  const treePool = [];
  const boxPool = [];
  function init() {
    scene = new (void 0)();
    scene.background = new (void 0)(8900331);
    camera = new (void 0)(75, window.innerWidth / window.innerHeight, 0.1, 1e3);
    camera.position.set(0, 2, 0);
    camera.lookAt(new (void 0)(0, 2, 1));
    renderer = new (void 0)({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = void 0;
    document.getElementById("view3d").appendChild(renderer.domElement);
    window.addEventListener("resize", onWindowResize);
    const ambient = new (void 0)(16777215, 0.4);
    scene.add(ambient);
    const dir = new (void 0)(16777215, 1);
    dir.position.set(15, 40, -20);
    dir.target.position.set(0, 0, 50);
    scene.add(dir.target);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    const shadowCamSize = laneWidth * 2;
    dir.shadow.camera.left = -shadowCamSize;
    dir.shadow.camera.right = shadowCamSize;
    dir.shadow.camera.top = shadowCamSize;
    dir.shadow.camera.bottom = -shadowCamSize;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = spawnMaxZ + 100;
    dir.shadow.bias = -5e-4;
    scene.add(dir);
    const groundGeo = new (void 0)(2e3, 2e3, 8, 8);
    const groundMat = new (void 0)({ color: 16777215, shininess: 2 });
    const ground = new (void 0)(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    for (let i = 0; i < treeCount; i++) {
      const tree = createTree();
      resetTree(tree);
      scene.add(tree);
      treePool.push(tree);
    }
    for (let i = 0; i < boxCount; i++) {
      const box = createPresent();
      resetBox(box);
      scene.add(box);
      box.userData.active = true;
      boxPool.push(box);
    }
    const snowGeometry = new (void 0)();
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[3 * i] = (void 0).randFloatSpread(laneWidth * 2);
      snowPositions[3 * i + 1] = (void 0).randFloat(10, 50);
      snowPositions[3 * i + 2] = (void 0).randFloat(-10, spawnMaxZ);
    }
    snowGeometry.setAttribute("position", new (void 0)(snowPositions, 3));
    const snowMaterial = new (void 0)({ color: 16777215, size: 0.5, transparent: true, opacity: 0.8 });
    snowParticles = new (void 0)(snowGeometry, snowMaterial);
    scene.add(snowParticles);
    for (let i = 0; i < barrierCountPerSide; i++) {
      const leftBarrier = createBarrierSegment("left");
      scene.add(leftBarrier);
      barrierPool.push(leftBarrier);
      const rightBarrier = createBarrierSegment("right");
      scene.add(rightBarrier);
      barrierPool.push(rightBarrier);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchStart, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("gamepadconnected", (e) => {
      if (gamepadIndex === null) {
        gamepadIndex = e.gamepad.index;
        console.log(`Gamepad connected at index ${gamepadIndex}: ${e.gamepad.id}`);
      }
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      if (gamepadIndex === e.gamepad.index) {
        console.log(`Gamepad disconnected from index ${gamepadIndex}: ${e.gamepad.id}`);
        gamepadIndex = null;
      }
    });
    restartButton.addEventListener("click", resetGame);
    animate();
  }
  function createTree() {
    const group = new (void 0)();
    const trunk = new (void 0)(
      new (void 0)(0.5, 0.5, 5),
      new (void 0)({ color: 9127187 })
    );
    trunk.position.y = 2.5;
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new (void 0)(
      new (void 0)(2, 4),
      new (void 0)({ color: 25600 })
    );
    leaves.position.y = 7;
    leaves.castShadow = true;
    group.add(leaves);
    return group;
  }
  function resetTree(tree) {
    tree.position.x = (void 0).randFloatSpread(laneWidth * 2);
    tree.position.z = (void 0).randFloat(spawnMinZ, spawnMaxZ);
  }
  function resetBox(box) {
    box.position.x = (void 0).randFloatSpread(laneWidth * 2);
    box.position.z = (void 0).randFloat(spawnMinZ, spawnMaxZ);
    box.userData.active = true;
    box.visible = true;
  }
  function makeBarrierTexture(withText) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const w = canvas.width, h = canvas.height;
      const stripeCount = 8;
      const stripeWidth = Math.ceil(w / stripeCount);
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#DDDDDD" : "#87CEEB";
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, h);
      }
      if (withText) {
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const texts = ["Merefield Technology", "https://merefield.tech"];
        const text = texts[Math.floor(Math.random() * texts.length)];
        ctx.fillText(text, w / 2, h / 2);
      }
    }
    const texture = new (void 0)(canvas);
    texture.wrapS = void 0;
    texture.wrapT = void 0;
    return texture;
  }
  function resetBarrier(barrier) {
    const offsetX = laneWidth + barrierThickness / 2;
    barrier.position.x = barrier.userData.side === "left" ? -offsetX : offsetX;
    barrier.position.z = (void 0).randFloat(spawnMinZ, spawnMaxZ);
  }
  function createBarrierSegment(side) {
    const withText = Math.random() < barrierTextChance;
    const texture = makeBarrierTexture(withText);
    const geo = new (void 0)(barrierThickness, barrierHeight, barrierSegmentLength);
    const mat = new (void 0)({ map: texture });
    const mesh = new (void 0)(geo, mat);
    mesh.position.y = barrierHeight / 2;
    mesh.castShadow = true;
    mesh.userData.side = side;
    mesh.userData.withText = withText;
    resetBarrier(mesh);
    return mesh;
  }
  function createPresent() {
    const group = new (void 0)();
    const boxMesh = new (void 0)(
      new (void 0)(1, 1, 1),
      new (void 0)({ color: 16711680 })
    );
    boxMesh.position.y = 0.5;
    boxMesh.castShadow = true;
    group.add(boxMesh);
    const ribbonMat = new (void 0)({ color: 16776960 });
    const ribbonX = new (void 0)(
      new (void 0)(1.2, 0.1, 0.1),
      ribbonMat
    );
    ribbonX.position.set(0, 0.5, 0);
    ribbonX.castShadow = true;
    group.add(ribbonX);
    const ribbonZ = new (void 0)(
      new (void 0)(0.1, 0.1, 1.2),
      ribbonMat
    );
    ribbonZ.position.set(0, 0.5, 0);
    ribbonZ.castShadow = true;
    group.add(ribbonZ);
    return group;
  }
  function createGate(isLevelGate = false) {
    const halfWidth = gateWidth / 2;
    const centerX = (void 0).randFloatSpread((laneWidth - halfWidth) * 2);
    const leftX = centerX - halfWidth;
    const rightX = centerX + halfWidth;
    const group = new (void 0)();
    group.userData = { leftX, rightX, passed: false, isLevelGate };
    const poleMat = new (void 0)({ color: 6636321 });
    const poleGeo = new (void 0)(gatePoleRadius, gatePoleRadius, gatePoleHeight);
    const leftPole = new (void 0)(poleGeo, poleMat);
    leftPole.position.set(leftX, gatePoleHeight / 2, 0);
    leftPole.castShadow = true;
    group.add(leftPole);
    const rightPole = new (void 0)(poleGeo, poleMat);
    rightPole.position.set(rightX, gatePoleHeight / 2, 0);
    rightPole.castShadow = true;
    group.add(rightPole);
    if (isLevelGate) {
      const bannerHeight = 1.2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#00008B";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "bold 48px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const levelGateIndex = gatesSpawned / 5;
      const bannerText = levelGateIndex % 2 === 0 ? "https://merefield.tech" : "Merefield Technology";
      ctx.fillText(bannerText, canvas.width / 2, canvas.height / 2);
      const texture = new (void 0)(canvas);
      texture.minFilter = void 0;
      const bannerMat = new (void 0)({ map: texture, side: void 0 });
      const bannerGeo = new (void 0)(gateWidth, bannerHeight);
      const banner = new (void 0)(bannerGeo, bannerMat);
      banner.position.set(centerX, gatePoleHeight + bannerHeight / 2, 0);
      banner.rotation.y = Math.PI;
      banner.castShadow = true;
      group.add(banner);
    } else {
      const flagGeo = new (void 0)(gateFlagSize, gateFlagSize);
      const leftFlag = new (void 0)(flagGeo, new (void 0)({ color: 16716947, side: void 0 }));
      leftFlag.position.set(leftX + gatePoleRadius + 0.01, gatePoleHeight * 0.75, 0);
      leftFlag.castShadow = true;
      group.add(leftFlag);
      const rightFlag = new (void 0)(flagGeo, new (void 0)({ color: 9699539, side: void 0 }));
      rightFlag.position.set(rightX - gatePoleRadius - 0.01, gatePoleHeight * 0.75, 0);
      rightFlag.castShadow = true;
      group.add(rightFlag);
    }
    return group;
  }
  function createSnowman() {
    const group = new (void 0)();
    const mat = new (void 0)({ color: 16777215 });
    const body = new (void 0)(new (void 0)(1, 16, 16), mat);
    body.position.y = 1;
    body.castShadow = true;
    group.add(body);
    const head = new (void 0)(new (void 0)(0.7, 16, 16), mat);
    head.position.y = 1 + 1 + 0.7;
    head.castShadow = true;
    group.add(head);
    return group;
  }
  function resetSnowman(sm) {
    sm.position.x = (void 0).randFloatSpread(laneWidth * 2);
    sm.position.z = (void 0).randFloat(spawnMinZ, spawnMaxZ);
  }
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  function onKeyDown(e) {
    if (e.key === "ArrowLeft" || e.key === "a")
      playerVx = playerSpeed;
    if (e.key === "ArrowRight" || e.key === "d")
      playerVx = -playerSpeed;
    if ((e.key === " " || e.key === "Enter") && gameOver)
      resetGame();
  }
  function onKeyUp(e) {
    if ((e.key === "ArrowLeft" || e.key === "a") && playerVx > 0)
      playerVx = 0;
    if ((e.key === "ArrowRight" || e.key === "d") && playerVx < 0)
      playerVx = 0;
  }
  function onTouchStart(e) {
    if (gameOver)
      return;
    e.preventDefault();
    const x = e.touches[0].clientX;
    if (x < window.innerWidth / 2) {
      playerVx = playerSpeed;
    } else {
      playerVx = -playerSpeed;
    }
  }
  function onTouchEnd(e) {
    if (gameOver)
      return;
    e.preventDefault();
    playerVx = 0;
  }
  function animate() {
    if (!gameOver) {
      requestAnimationFrame(animate);
    }
    const now = performance.now();
    const dt = (now - lastTime) / 1e3;
    lastTime = now;
    if (gamepadIndex !== null) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : null;
      const gp = gamepads && gamepads[gamepadIndex];
      if (gp) {
        const axisX = gp.axes[0] || 0;
        const magnitude = Math.abs(axisX);
        if (magnitude > GAMEPAD_DEADZONE) {
          const sign = axisX > 0 ? 1 : -1;
          const scaled = (magnitude - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE);
          playerVx = -sign * scaled * playerSpeed * GAMEPAD_SPEED_MULTIPLIER;
        } else {
          if (Math.abs(playerVx) !== playerSpeed) {
            playerVx = 0;
          }
        }
      }
    }
    const posAttr = snowParticles.geometry.attributes.position;
    const sp = posAttr.array;
    for (let i = 0; i < snowCount; i++) {
      const idx = 3 * i;
      sp[idx + 1] -= snowFallSpeed * dt;
      if (sp[idx + 1] < 0) {
        sp[idx + 1] = (void 0).randFloat(10, 50);
        sp[idx] = (void 0).randFloatSpread(laneWidth * 2);
        sp[idx + 2] = (void 0).randFloat(-10, spawnMaxZ);
      }
    }
    posAttr.needsUpdate = true;
    playerX += playerVx * dt;
    playerX = (void 0).clamp(playerX, -laneWidth, laneWidth);
    camera.position.x = playerX;
    camera.lookAt(new (void 0)(playerX, camera.position.y, camera.position.z + 1));
    for (const tree of treePool) {
      tree.position.z -= currentSpeed * dt;
      if (tree.position.z < -10) {
        resetTree(tree);
      } else {
        const dx = tree.position.x - playerX;
        const dz = tree.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 2) {
          playCrashSound();
          endGame("You hit a tree!");
        }
      }
    }
    for (const box of boxPool) {
      if (!box.userData.active)
        continue;
      box.position.z -= currentSpeed * dt;
      if (box.position.z < -10) {
        resetBox(box);
      } else {
        const dx = box.position.x - playerX;
        const dz = box.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
          playKatchSound();
          bonusPoints += 10;
          box.userData.active = false;
          box.visible = false;
        }
      }
    }
    for (const barrier of barrierPool) {
      barrier.position.z -= currentSpeed * dt;
      if (barrier.position.z < -10) {
        resetBarrier(barrier);
      }
    }
    timeAlive += dt;
    const score = Math.floor(timeAlive) + bonusPoints;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("highScore", String(highScore));
      highScoreElement.innerText = `High Score: ${highScore}`;
      try {
        const shareUrl = process.env.URL;
        let shareLink = document.getElementById("shareLink");
        if (!shareLink) {
          shareLink = document.createElement("a");
          shareLink.id = "shareLink";
          shareLink.style.display = "block";
          shareLink.style.marginTop = "8px";
          highScoreElement.parentElement?.insertBefore(shareLink, highScoreElement.nextSibling);
        }
        shareLink.href = shareUrl;
        shareLink.target = "_blank";
        shareLink.innerText = `See if you can beat my high score: ${score}!`;
      } catch {
      }
    }
    scoreElement.innerText = `Score: ${score}`;
    totalDistance += currentSpeed * dt;
    if (totalDistance - lastGateDistance >= gateSpacing) {
      lastGateDistance += gateSpacing;
      gatesSpawned++;
      const isLevelGate = gatesSpawned % 5 === 0;
      const gate = createGate(isLevelGate);
      gate.position.z = spawnMaxZ + gateSpawnOffset;
      scene.add(gate);
      gatePool.push(gate);
    }
    for (let i = 0; i < gatePool.length; i++) {
      const gate = gatePool[i];
      gate.position.z -= currentSpeed * dt;
      if (!gate.userData.passed && gate.position.z < 0) {
        const px = playerX;
        if (px < gate.userData.leftX || px > gate.userData.rightX) {
          playCrashSound();
          endGame("Missed a gate!");
        } else {
          if (gate.userData.isLevelGate) {
            playGateSuccessSound();
            level++;
            levelElement.innerText = `Level: ${level}`;
            currentSpeed += SPEED_LEVEL_INCREMENT;
            treesPerInterval += TREES_PER_INTERVAL_INCREMENT;
            for (let i2 = 0; i2 < treesPerInterval && treePool.length < maxTreeCount; i2++) {
              const newTree = createTree();
              resetTree(newTree);
              scene.add(newTree);
              treePool.push(newTree);
            }
          } else {
            playGateSuccessSound();
          }
        }
        gate.userData.passed = true;
      }
      if (gate.position.z < -10) {
        scene.remove(gate);
        gatePool.splice(i, 1);
        i--;
      }
    }
    if (timeAlive - lastSnowmanTime >= snowmanInterval) {
      lastSnowmanTime += snowmanInterval;
      const sm = createSnowman();
      resetSnowman(sm);
      scene.add(sm);
      snowmanPool.push(sm);
    }
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
        endGame("You hit a snowman!");
      }
    }
    renderer.render(scene, camera);
  }
  function endGame(reason) {
    if (gameOver)
      return;
    gameOver = true;
    if (reason) {
      failReasonElement.innerText = reason;
    }
    gameOverElement.classList.remove("hidden");
    waitForRestart();
    const finalScore = Math.floor(timeAlive) + bonusPoints;
    showHighScoresBoard(finalScore);
  }
  async function showHighScoresBoard(finalScore) {
    gameOverElement.classList.remove("hidden");
    const containerId = "highScoresBoard";
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.textAlign = "center";
      container.style.marginTop = "10px";
      gameOverElement.appendChild(container);
    } else {
      container.innerHTML = "";
    }
    try {
      const resp = await fetch("/api/high-scores");
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
      let scores = await resp.json();
      const qualifies = scores.length < 3 || finalScore > scores[scores.length - 1].score;
      const storedName = localStorage.getItem("hsName") || "";
      console.log("[DEBUG] showHighScoresBoard: retrieved hsName from localStorage:", storedName);
      if (qualifies) {
        if (!storedName) {
          const info = document.createElement("div");
          info.innerText = "Congratulations! You made the top 3. Enter your name:";
          container.appendChild(info);
          const input = document.createElement("input");
          input.type = "text";
          container.appendChild(input);
          const submitBtn = document.createElement("button");
          submitBtn.innerText = "Submit";
          container.appendChild(submitBtn);
          submitBtn.addEventListener("click", async () => {
            const name = input.value.trim();
            if (!name) {
              alert("Please enter a name");
              return;
            }
            try {
              console.log("[DEBUG] showHighScoresBoard: about to set hsName in localStorage. Old:", localStorage.getItem("hsName"), "New:", name);
              localStorage.setItem("hsName", name);
              console.log("[DEBUG] showHighScoresBoard: localStorage hsName now:", localStorage.getItem("hsName"));
              console.log("[DEBUG] showHighScoresBoard: submitting new high score, name:", name, "score:", finalScore);
              const postResp = await fetch("/api/high-scores", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-API-Key": process.env.HIGH_SCORES_TOKEN || ""
                },
                body: JSON.stringify({ name, score: finalScore, level })
              });
              console.log("[DEBUG] showHighScoresBoard: POST response status:", postResp.status);
              if (!postResp.ok)
                throw new Error(`HTTP ${postResp.status}`);
              scores = await postResp.json();
              console.log("[DEBUG] showHighScoresBoard: updated scores from POST:", scores);
              renderScoresTable(container, scores);
              input.disabled = true;
              submitBtn.disabled = true;
            } catch (err) {
              console.error("[DEBUG] showHighScoresBoard: error saving score:", err);
              alert("Failed to save score");
            }
          });
        } else {
          const info = document.createElement("div");
          info.innerText = `Submitting your score as ${storedName}`;
          container.appendChild(info);
          try {
            console.log("[DEBUG] showHighScoresBoard: auto-submitting high score, name:", storedName, "score:", finalScore);
            const postResp = await fetch("/api/high-scores", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": process.env.HIGH_SCORES_TOKEN || ""
              },
              body: JSON.stringify({ name: storedName, score: finalScore, level })
            });
            console.log("[DEBUG] showHighScoresBoard: auto-submit POST response status:", postResp.status);
            if (!postResp.ok)
              throw new Error(`HTTP ${postResp.status}`);
            scores = await postResp.json();
            console.log("[DEBUG] showHighScoresBoard: auto-submit updated scores:", scores);
          } catch (err) {
            console.error("[DEBUG] showHighScoresBoard: error auto-submitting score:", err);
            alert("Failed to save score");
          }
        }
      }
      renderScoresTable(container, scores);
    } catch (err) {
      console.error("Error loading high scores:", err);
    }
  }
  function renderScoresTable(container, scores) {
    let title = container.querySelector("h3");
    if (!title) {
      title = document.createElement("h3");
      title.innerText = "High Scores";
      container.appendChild(title);
    }
    let table = container.querySelector("table");
    if (table) {
      table.remove();
    }
    table = document.createElement("table");
    table.style.margin = "0 auto";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Rank", "Name", "Score", "Level"].forEach((text) => {
      const th = document.createElement("th");
      th.innerText = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    scores.slice(0, 3).forEach((entry, idx) => {
      const tr = document.createElement("tr");
      const rankTd = document.createElement("td");
      rankTd.innerText = `#${idx + 1}`;
      const nameTd = document.createElement("td");
      nameTd.innerText = entry.name;
      const scoreTd = document.createElement("td");
      scoreTd.innerText = String(entry.score);
      tr.appendChild(rankTd);
      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      const levelTd = document.createElement("td");
      levelTd.innerText = String(entry.level || "");
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
    gameOverElement.classList.add("hidden");
    level = 1;
    gatesSpawned = 0;
    currentSpeed = START_SPEED;
    levelElement.innerText = `Level: ${level}`;
    treePool.forEach((tree) => scene.remove(tree));
    treePool.length = 0;
    for (let i = 0; i < treeCount; i++) {
      const tree = createTree();
      resetTree(tree);
      scene.add(tree);
      treePool.push(tree);
    }
    boxPool.forEach(resetBox);
    gatePool.forEach((g) => scene.remove(g));
    gatePool.length = 0;
    totalDistance = 0;
    lastGateDistance = 0;
    snowmanPool.forEach((s) => scene.remove(s));
    snowmanPool.length = 0;
    lastSnowmanTime = 0;
    prevAButtonPressed = false;
    failReasonElement.innerText = "";
    animate();
  }
  function waitForRestart() {
    if (!gameOver)
      return;
    requestAnimationFrame(waitForRestart);
    if (gamepadIndex === null)
      return;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : null;
    const gp = gamepads && gamepads[gamepadIndex];
    if (!gp)
      return;
    const aPressed = gp.buttons[0]?.pressed || false;
    if (aPressed && !prevAButtonPressed) {
      resetGame();
      return;
    }
    prevAButtonPressed = aPressed;
  }
  init();
})();
