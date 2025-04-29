# Forest Runner

## Game Description

A fast-paced 3D endless runner game built with Three.js. Navigate through a forest and avoid trees while collecting red boxes for bonus points.

## How to Play

Use arrow keys (⟵/⟶ or A/D) or a connected game-pad’s left analogue stick to move left or right. On mobile, tap the left or right half of the screen. Survive as long as possible without colliding with trees. Collect red boxes for extra points.

## Running Locally

### Using Deno + Denon

1. Install [Deno](https://deno.land/) and [Denon](https://github.com/denoland/denon):

       npm install -g denon

2. Start the server:

       denon start

   Or, without Denon (using Deno directly):

       deno run --allow-net --allow-read --allow-env --allow-write --allow-run server.ts

3. Open http://localhost:8000 in your browser.

Alternatively, serve the directory over HTTP and open `index.html` directly.
