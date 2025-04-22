import { Maze } from './maze.js';
import { initBuildMode } from './buildMode.js';
import { initSolveMode } from './solveMode.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize maze with double size (16x16)
  const maze = new Maze(16, 16);

  const modeBuildBtn = document.getElementById('mode-build');
  const modeSolveBtn = document.getElementById('mode-solve');
  const buildToolbar = document.getElementById('build-toolbar');
  const solveToolbar = document.getElementById('solve-toolbar');
  const gridContainer = document.getElementById('grid');
  const view3d = document.getElementById('view3d');
  const buildDoneBtn = document.getElementById('build-done');
  const autoSolveBtn = document.getElementById('auto-solve');
  let solveHandlers = null;

  modeBuildBtn.addEventListener('click', switchToBuild);
  modeSolveBtn.addEventListener('click', switchToSolve);
  buildDoneBtn.addEventListener('click', switchToSolve);
  autoSolveBtn.addEventListener('click', () => {
    if (solveHandlers && solveHandlers.autoSolve) solveHandlers.autoSolve();
  });

  function switchToBuild() {
    modeBuildBtn.classList.add('active');
    modeSolveBtn.classList.remove('active');
    buildToolbar.style.display = 'flex';
    solveToolbar.style.display = 'none';
    gridContainer.style.display = 'grid';
    view3d.style.display = 'none';
  }

  function switchToSolve() {
    modeBuildBtn.classList.remove('active');
    modeSolveBtn.classList.add('active');
    buildToolbar.style.display = 'none';
    solveToolbar.style.display = 'flex';
    gridContainer.style.display = 'none';
    view3d.style.display = 'block';
    solveHandlers = initSolveMode(maze, view3d);
  }

  // Initialize build mode on start
  initBuildMode(maze, gridContainer);
});