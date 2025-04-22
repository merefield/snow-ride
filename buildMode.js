export function initBuildMode(maze, gridContainer) {
  const width = maze.width;
  const height = maze.height;
  const cellSize = 40;
  const edgeSize = 10;
  // Configure grid layout
  const cols = [];
  for (let i = 0; i < width; i++) {
    cols.push(`${edgeSize}px`, `${cellSize}px`);
  }
  cols.push(`${edgeSize}px`);
  const rows = [];
  for (let i = 0; i < height; i++) {
    rows.push(`${edgeSize}px`, `${cellSize}px`);
  }
  rows.push(`${edgeSize}px`);
  gridContainer.innerHTML = '';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = cols.join(' ');
  gridContainer.style.gridTemplateRows = rows.join(' ');

  // Create grid cells and edges
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < cols.length; col++) {
      const div = document.createElement('div');
      if (row % 2 === 0 && col % 2 === 0) {
        div.classList.add('corner');
      } else if (row % 2 === 0 && col % 2 === 1) {
        // Horizontal edge
        const x = (col - 1) / 2;
        const y = row / 2;
        div.classList.add('edge', 'h-edge');
        div.dataset.x = x;
        div.dataset.y = y;
        div.dataset.orient = 'h';
        // Initial wall state
        if (maze.hasWallEdge(x, y, 'h')) div.classList.add('wall');
      } else if (row % 2 === 1 && col % 2 === 0) {
        // Vertical edge
        const x = col / 2;
        const y = (row - 1) / 2;
        div.classList.add('edge', 'v-edge');
        div.dataset.x = x;
        div.dataset.y = y;
        div.dataset.orient = 'v';
        // Initial wall state
        if (maze.hasWallEdge(x, y, 'v')) div.classList.add('wall');
      } else {
        // Cell
        const x = (col - 1) / 2;
        const y = (row - 1) / 2;
        div.classList.add('cell');
        div.dataset.x = x;
        div.dataset.y = y;
      }
      gridContainer.appendChild(div);
    }
  }

  // Tool selection
  let currentTool = 'wall';
  const toolButtons = document.querySelectorAll('.tool');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.id.replace('tool-', '');
    });
  });

  // Click handler
  gridContainer.addEventListener('click', e => {
    const target = e.target;
    const x = parseInt(target.dataset.x, 10);
    const y = parseInt(target.dataset.y, 10);
    const tool = currentTool;
    if (tool === 'wall' && target.classList.contains('edge')) {
      maze.toggleWallEdge(x, y, target.dataset.orient);
      target.classList.toggle('wall', maze.hasWallEdge(x, y, target.dataset.orient));
    } else if (tool === 'start' && target.classList.contains('cell')) {
      const prev = gridContainer.querySelector('.cell.start');
      if (prev) prev.classList.remove('start');
      maze.setStart(x, y);
      target.classList.add('start');
    } else if (tool === 'exit' && target.classList.contains('cell')) {
      const prev = gridContainer.querySelector('.cell.exit');
      if (prev) prev.classList.remove('exit');
      maze.setExit(x, y);
      target.classList.add('exit');
    }
  });
  // Randomize maze generation
  const randomBtn = document.getElementById('build-random');
  randomBtn.addEventListener('click', () => {
    const w = maze.width;
    const h = maze.height;
    // Reset all interior walls (set to true)
    for (let y = 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!maze.hasWallEdge(x, y, 'h')) maze.toggleWallEdge(x, y, 'h');
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 1; x < w; x++) {
        if (!maze.hasWallEdge(x, y, 'v')) maze.toggleWallEdge(x, y, 'v');
      }
    }
    // Carve passages with DFS
    const visited = Array.from({ length: h }, () => Array(w).fill(false));
    const dirs = [ {dx:1,dy:0,orient:'v'}, {dx:-1,dy:0,orient:'v'}, {dx:0,dy:1,orient:'h'}, {dx:0,dy:-1,orient:'h'} ];
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    function carve(cx, cy) {
      visited[cy][cx] = true;
      const moves = dirs.slice(); shuffle(moves);
      for (const m of moves) {
        const nx = cx + m.dx;
        const ny = cy + m.dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny][nx]) {
          // remove wall between
          if (m.orient === 'h') maze.toggleWallEdge(cx, cy + (m.dy>0?1:0), 'h');
          else maze.toggleWallEdge(cx + (m.dx>0?1:0), cy, 'v');
          carve(nx, ny);
        }
      }
    }
    carve(0, 0);
    // Update UI edge elements
    const edges = gridContainer.querySelectorAll('.edge');
    edges.forEach(el => {
      const ex = parseInt(el.dataset.x, 10);
      const ey = parseInt(el.dataset.y, 10);
      const orient = el.dataset.orient;
      el.classList.toggle('wall', maze.hasWallEdge(ex, ey, orient));
    });
    // Place new start and exit
    // Clear previous
    gridContainer.querySelectorAll('.cell.start, .cell.exit').forEach(c => c.classList.remove('start', 'exit'));
    maze.setStart(0, 0);
    maze.setExit(w-1, h-1);
    const startEl = gridContainer.querySelector(`.cell[data-x="0"][data-y="0"]`);
    const exitEl = gridContainer.querySelector(`.cell[data-x="${w-1}"][data-y="${h-1}"]`);
    if (startEl) startEl.classList.add('start');
    if (exitEl) exitEl.classList.add('exit');
  });
}