// solveMode.ts - handles maze solving and 3D rendering
import { Maze } from "./maze.ts";

declare const THREE: any;
declare const Hammer: any;

export function initSolveMode(
  maze: Maze,
  container: HTMLDivElement
): { autoSolve: () => void } {
  container.innerHTML = "";
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });

  const floorGeom = new THREE.PlaneGeometry(maze.width, maze.height);
  const floor = new THREE.Mesh(floorGeom, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(maze.width / 2, 0, -maze.height / 2);
  scene.add(floor);

  const wallGeom = new THREE.BoxGeometry(1, 1, 1);
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const cell = maze.getCell(x, y);
      if (cell && cell.wall) {
        const wall = new THREE.Mesh(wallGeom, wallMaterial);
        wall.position.set(x + 0.5, 0.5, -(y + 0.5));
        scene.add(wall);
      }
    }
  }

  const ambient = new THREE.AmbientLight(0x404040);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(1, 2, 1);
  scene.add(ambient, dirLight);

  let playerX = maze.start!.x;
  let playerY = maze.start!.y;
  let dir = 0;

  function updateCamera() {
    const posX = playerX + 0.5;
    const posZ = -(playerY + 0.5);
    camera.position.set(posX, 0.5, posZ);
    camera.rotation.set(0, -dir * Math.PI / 2, 0);
  }
  updateCamera();

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  const moves = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  function moveForward() {
    const m = moves[dir];
    const nx = playerX + m.dx;
    const ny = playerY + m.dy;
    const next = maze.getCell(nx, ny);
    if (next && !next.wall) {
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

  function findPath() {
    const start = maze.start!;
    const end = maze.exit!;
    const queue: any[] = [{ x: start.x, y: start.y, parent: null }];
    const visited = Array.from({ length: maze.height }, () =>
      Array(maze.width).fill(false)
    );
    visited[start.y][start.x] = true;
    let target: any = null;
    while (queue.length) {
      const cur = queue.shift();
      if (cur.x === end.x && cur.y === end.y) {
        target = cur;
        break;
      }
      for (const m of moves) {
        const nx = cur.x + m.dx;
        const ny = cur.y + m.dy;
        if (
          nx >= 0 &&
          nx < maze.width &&
          ny >= 0 &&
          ny < maze.height
        ) {
          const c = maze.getCell(nx, ny);
          if (!visited[ny][nx] && c && !c.wall) {
            visited[ny][nx] = true;
            queue.push({ x: nx, y: ny, parent: cur });
          }
        }
      }
    }
    if (!target) return null;
    const path: any[] = [];
    let cur = target;
    while (cur) {
      path.push({ x: cur.x, y: cur.y });
      cur = cur.parent;
    }
    return path.reverse();
  }

  function pathToCommands(path: any[]) {
    const cmds: string[] = [];
    let cdir = 0;
    let cx = path[0].x;
    let cy = path[0].y;
    for (let i = 1; i < path.length; i++) {
      const nx = path[i].x;
      const ny = path[i].y;
      const dx = nx - cx;
      const dy = ny - cy;
      let needed = 0;
      if (dx === 1) needed = 1;
      else if (dx === -1) needed = 3;
      else if (dy === 1) needed = 2;
      else if (dy === -1) needed = 0;
      const diff = (needed - cdir + 4) % 4;
      if (diff === 3) cmds.push("turnLeft");
      else {
        for (let t = 0; t < diff; t++) cmds.push("turnRight");
      }
      cmds.push("moveForward");
      cdir = needed;
      cx = nx;
      cy = ny;
    }
    return cmds;
  }

  function animateCommands(cmds: string[], i = 0) {
    if (i >= cmds.length) return;
    const cmd = cmds[i];
    if (cmd === "moveForward") moveForward();
    else if (cmd === "turnLeft") turnLeft();
    else if (cmd === "turnRight") turnRight();
    setTimeout(() => animateCommands(cmds, i + 1), 300);
  }

  function autoSolve() {
    const path = findPath();
    if (!path) {
      alert("No path found");
      return;
    }
    const cmds = pathToCommands(path);
    animateCommands(cmds);
  }

  const hammer = new Hammer(container);
  hammer.get("swipe").set({ direction: Hammer.DIRECTION_ALL });
  hammer.on("swipeup", moveForward);
  hammer.on("swipeleft", turnLeft);
  hammer.on("swiperight", turnRight);

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") moveForward();
    else if (e.key === "ArrowLeft") turnLeft();
    else if (e.key === "ArrowRight") turnRight();
  });

  return { autoSolve };
}