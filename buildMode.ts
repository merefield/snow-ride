// buildMode.ts - handles maze building UI
import { Maze } from "./maze.ts";

export function initBuildMode(maze: Maze, gridContainer: HTMLDivElement) {
  const width = maze.width;
  const height = maze.height;
  gridContainer.innerHTML = "";
  gridContainer.style.display = "grid";
  gridContainer.style.gridTemplateColumns = `repeat(${width}, 40px)`;
  gridContainer.style.gridTemplateRows = `repeat(${height}, 40px)`;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellDiv = document.createElement("div");
      cellDiv.classList.add("cell");
      cellDiv.dataset.x = x.toString();
      cellDiv.dataset.y = y.toString();
      gridContainer.appendChild(cellDiv);
    }
  }

  let currentTool = "wall";
  const toolButtons = document.querySelectorAll(".tool");
  toolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      toolButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTool = btn.id.replace("tool-", "");
    });
  });

  gridContainer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("cell")) return;
    const x = parseInt(target.dataset.x || "0", 10);
    const y = parseInt(target.dataset.y || "0", 10);
    const cellData = maze.getCell(x, y);
    if (!cellData) return;
    if (currentTool === "wall") {
      maze.setWall(x, y, !cellData.wall);
      target.classList.toggle("wall", maze.getCell(x, y)!.wall);
    } else if (currentTool === "start") {
      if (maze.start) {
        const prev = gridContainer.querySelector(".cell.start");
        if (prev) prev.classList.remove("start");
      }
      maze.setStart(x, y);
      target.classList.add("start");
    } else if (currentTool === "exit") {
      if (maze.exit) {
        const prev = gridContainer.querySelector(".cell.exit");
        if (prev) prev.classList.remove("exit");
      }
      maze.setExit(x, y);
      target.classList.add("exit");
    }
  });
}