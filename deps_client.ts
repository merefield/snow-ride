// Browser-only dependencies.

// Use a **default export** for Three.js because esbuild currently mishandles
// property accesses on a `* as ns` (namespace) import coming from a remote
// URL. Importing the module and then re-exporting it as the *default* avoids
// the issue while still giving the game code access to the full Three.js API
// through the familiar `THREE` identifier.

// Three.js via jsDelivr CDN. Keep the version in sync with game code.
// r176 / 0.176.0
import * as THREE_NS from "https://cdn.jsdelivr.net/npm/three@0.176.0/build/three.module.js";
export default THREE_NS;
