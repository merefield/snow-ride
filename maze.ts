// maze.ts - stores maze grid, walls, start and exit positions
export interface Cell {
  wall: boolean;
  start: boolean;
  exit: boolean;
}

export class Maze {
  width: number;
  height: number;
  grid: Cell[][];
  start: { x: number; y: number } | null;
  exit: { x: number; y: number } | null;

  // width and height of maze grid; defaults doubled to 16x16
  constructor(width = 16, height = 16) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.start = null;
    this.exit = null;
    for (let y = 0; y < height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ wall: false, start: false, exit: false });
      }
      this.grid.push(row);
    }
  }

  getCell(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.grid[y][x];
  }

  setWall(x: number, y: number, wall: boolean) {
    const cell = this.getCell(x, y);
    if (!cell) return;
    cell.wall = wall;
  }

  setStart(x: number, y: number) {
    const cell = this.getCell(x, y);
    if (!cell) return;
    if (this.start) {
      const prev = this.getCell(this.start.x, this.start.y);
      if (prev) prev.start = false;
    }
    cell.start = true;
    this.start = { x, y };
  }

  setExit(x: number, y: number) {
    const cell = this.getCell(x, y);
    if (!cell) return;
    if (this.exit) {
      const prev = this.getCell(this.exit.x, this.exit.y);
      if (prev) prev.exit = false;
    }
    cell.exit = true;
    this.exit = { x, y };
  }
}