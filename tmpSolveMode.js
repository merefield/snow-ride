export function initSolveMode(maze, container) {
  // Clear container
  container.innerHTML = '';
  // Three.js setup
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  // Set sky color
  scene.background = new THREE.Color(0x87CEEB);

  // Materials
  // Load textures for walls and floor
  const textureLoader = new THREE.TextureLoader();
  // Wall stone texture
  const wallTexture = textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg'
  );
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(1, 1);
  const wallMaterial = new THREE.MeshLambertMaterial({ map: wallTexture });
  // Floor paving texture
  const floorTexture = textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg'
  );
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(maze.width / 2, maze.height / 2);
  const floorMaterial = new THREE.MeshLambertMaterial({ map: floorTexture });

  // Build floor
  const floorGeom = new THREE.PlaneGeometry(maze.width, maze.height);
  const floor = new THREE.Mesh(floorGeom, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(maze.width / 2, 0, -maze.height / 2);
  scene.add(floor);

  // Build walls from edges
  const wallThickness = 0.1;
  const wallHeight = 1;
  // Horizontal edges
  for (let y = 0; y <= maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.hasWallEdge(x, y, 'h')) {
        const geom = new THREE.BoxGeometry(1, wallHeight, wallThickness);
        const mesh = new THREE.Mesh(geom, wallMaterial);
        mesh.position.set(x + 0.5, wallHeight / 2, -y);
        scene.add(mesh);
      }
    }
  }
  // Vertical edges
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x <= maze.width; x++) {
      if (maze.hasWallEdge(x, y, 'v')) {
        const geom = new THREE.BoxGeometry(wallThickness, wallHeight, 1);
        const mesh = new THREE.Mesh(geom, wallMaterial);
        mesh.position.set(x, wallHeight / 2, -(y + 0.5));
        scene.add(mesh);
      }
    }
  }

  // Lights
  // Add lighting (slightly less dark)
  const ambient = new THREE.AmbientLight(0x888888);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(1, 2, 1);
  scene.add(ambient, dirLight);
  // Add table with a cup at the exit location
  if (maze.exit) {
    const exitX = maze.exit.x;
    const exitY = maze.exit.y;
    const tx = exitX + 0.5;
    const tz = -(exitY + 0.5);
    // Table top
    const tableMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.1, 1),
      tableMaterial
    );
    tableTop.position.set(tx, 0.55, tz);
    scene.add(tableTop);
    // Table legs
    const legGeom = new THREE.BoxGeometry(0.1, 0.5, 0.1);
    const legOffsets = [
      [0.45, 0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [-0.45, -0.45],
    ];
    legOffsets.forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(legGeom, tableMaterial);
      leg.position.set(tx + dx, 0.25, tz + dz);
      scene.add(leg);
    });
    // Cup
    const cupMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32),
      cupMaterial
    );
    cup.position.set(tx, 0.65, tz);
    scene.add(cup);
  }

  // Player state
  let playerX = maze.start.x;
  let playerY = maze.start.y;
  let dir = 0; // 0=N,1=E,2=S,3=W

  function updateCamera() {
    const posX = playerX + 0.5;
    const posZ = - (playerY + 0.5);
    camera.position.set(posX, 0.5, posZ);
    // Face direction: 0=N,1=E,2=S,3=W
    camera.rotation.set(0, dir * Math.PI / 2, 0);
  }
  updateCamera();

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  // Movement helpers
  const moves = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];

  function moveForward() {
    const m = moves[dir];
    const nx = playerX + m.dx;
    const ny = playerY + m.dy;
    // Prevent moving off-grid
    if (nx < 0 || nx >= maze.width || ny < 0 || ny >= maze.height) return;
    // Determine if there's a wall edge between current and next cell
    let blocked = false;
    if (m.dx === 1) {
      // moving east across vertical edge at x+1
      blocked = maze.hasWallEdge(playerX + 1, playerY, 'v');
    } else if (m.dx === -1) {
      // moving west across vertical edge at x
      blocked = maze.hasWallEdge(playerX, playerY, 'v');
    } else if (m.dy === -1) {
      // moving north across horizontal edge at y
      blocked = maze.hasWallEdge(playerX, playerY, 'h');
    } else if (m.dy === 1) {
      // moving south across horizontal edge at y+1
      blocked = maze.hasWallEdge(playerX, playerY + 1, 'h');
    }
    if (!blocked) {
      playerX = nx;
      playerY = ny;
      updateCamera();
    }
  }

  function turnLeft() {
    dir = (dir + 3) % 4;
    updateCamera();
  }

  function turnRight() {
    dir = (dir + 1) % 4;
    updateCamera();
  }

  // Pathfinding (BFS)
  function findPath() {
    const start = maze.start;
    const end = maze.exit;
    const queue = [{ x: start.x, y: start.y, parent: null }];
    const visited = Array.from({ length: maze.height }, () => Array(maze.width).fill(false));
    visited[start.y][start.x] = true;
    let target = null;
    while (queue.length) {
      const cur = queue.shift();
      if (cur.x === end.x && cur.y === end.y) { target = cur; break; }
      for (const m of moves) {
        const nx = cur.x + m.dx;
        const ny = cur.y + m.dy;
        // Check bounds
        if (nx < 0 || nx >= maze.width || ny < 0 || ny >= maze.height) continue;
        // Check wall edge between cur and neighbor
        let blocked = false;
        if (m.dx === 1) {
          blocked = maze.hasWallEdge(cur.x + 1, cur.y, 'v');
        } else if (m.dx === -1) {
          blocked = maze.hasWallEdge(cur.x, cur.y, 'v');
        } else if (m.dy === -1) {
          blocked = maze.hasWallEdge(cur.x, cur.y, 'h');
        } else if (m.dy === 1) {
          blocked = maze.hasWallEdge(cur.x, cur.y + 1, 'h');
        }
        if (!blocked && !visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny, parent: cur });
        }
      }
    }
    if (!target) return null;
    const path = [];
    let cur = target;
    while (cur) { path.push({ x: cur.x, y: cur.y }); cur = cur.parent; }
    return path.reverse();
  }

  function pathToCommands(path) {
    const cmds = [];
    let cdir = 0;
    let cx = path[0].x;
    let cy = path[0].y;
    for (let i = 1; i < path.length; i++) {
      const nx = path[i].x;
      const ny = path[i].y;
      const dx = nx - cx;
      const dy = ny - cy;
      let needed;
      if (dx === 1) needed = 1;
      else if (dx === -1) needed = 3;
      else if (dy === 1) needed = 2;
      else if (dy === -1) needed = 0;
      const diff = (needed - cdir + 4) % 4;
      if (diff === 3) cmds.push('turnLeft');
      else { for (let t = 0; t < diff; t++) cmds.push('turnRight'); }
      cmds.push('moveForward');
      cdir = needed;
      cx = nx; cy = ny;
    }
    return cmds;
  }

  // Animate commands
  function animateCommands(cmds, i = 0) {
    if (i >= cmds.length) return;
    const cmd = cmds[i];
    if (cmd === 'moveForward') moveForward();
    else if (cmd === 'turnLeft') turnLeft();
    else if (cmd === 'turnRight') turnRight();
    setTimeout(() => animateCommands(cmds, i + 1), 300);
  }

  function autoSolve() {
    const path = findPath();
    if (!path) { alert('No path found'); return; }
    const cmds = pathToCommands(path);
    animateCommands(cmds);
  }

  // Input handling
  const hammer = new Hammer(container);
  hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
  hammer.on('swipeup', moveForward);
  hammer.on('swipeleft', turnLeft);
  hammer.on('swiperight', turnRight);

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') moveForward();
    else if (e.key === 'ArrowLeft') turnLeft();
    else if (e.key === 'ArrowRight') turnRight();
  });

  return { autoSolve };
}