import { Maze } from './maze.js';
const maze = new Maze(8, 8);
console.log('hWalls[3][3]=', maze.hWalls[3][3]);
console.log('hasWallEdge(3,3,h)=', maze.hasWallEdge(3,3,'h'));
console.log('hasWallEdge(3,0,h)=', maze.hasWallEdge(3,0,'h'));
console.log('hasWallEdge(3,8,h)=', maze.hasWallEdge(3,8,'h'));
console.log('vWalls[3][3]=', maze.vWalls[3][3]);
console.log('hasWallEdge(0,3,v)=', maze.hasWallEdge(0,3,'v'));
console.log('hasWallEdge(8,3,v)=', maze.hasWallEdge(8,3,'v'));
