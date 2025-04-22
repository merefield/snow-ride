export class Maze {
  // width and height of maze grid; defaults doubled to 16x16
  constructor(width = 16, height = 16) {
    this.width = width;
    this.height = height;
    this.start = null;
    this.exit = null;
    // Edge walls: horizontal (height+1 x width) and vertical (height x width+1)
    this.hWalls = Array.from({ length: height + 1 }, () => Array(width).fill(false));
    this.vWalls = Array.from({ length: height }, () => Array(width + 1).fill(false));
    // Initialize boundary walls
    for (let x = 0; x < width; x++) {
      this.hWalls[0][x] = true;
      this.hWalls[height][x] = true;
    }
    for (let y = 0; y < height; y++) {
      this.vWalls[y][0] = true;
      this.vWalls[y][width] = true;
    }
  }

  // Toggle a wall edge at (x,y) with orientation 'h' or 'v'
  toggleWallEdge(x, y, orient) {
    if (orient === 'h') {
      if (y < 0 || y > this.height || x < 0 || x >= this.width) return;
      this.hWalls[y][x] = !this.hWalls[y][x];
    } else if (orient === 'v') {
      if (y < 0 || y >= this.height || x < 0 || x > this.width) return;
      this.vWalls[y][x] = !this.vWalls[y][x];
    }
  }

  // Check if a wall edge exists
  hasWallEdge(x, y, orient) {
    if (orient === 'h') {
      if (y < 0 || y > this.height || x < 0 || x >= this.width) return true;
      return this.hWalls[y][x];
    } else if (orient === 'v') {
      if (y < 0 || y >= this.height || x < 0 || x > this.width) return true;
      return this.vWalls[y][x];
    }
    return false;
  }

  setStart(x, y) {
    this.start = { x, y };
  }

  setExit(x, y) {
    this.exit = { x, y };
  }
}