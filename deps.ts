// Consolidated external dependencies for the project.
// Import from this module everywhere else so version upgrades are
// managed in a single place.

export { serve } from "https://deno.land/std@0.171.0/http/server.ts";
export { serveFile } from "https://deno.land/std@0.171.0/http/file_server.ts";

export { build, stop } from "https://deno.land/x/esbuild@v0.17.19/mod.js";

export { parse, stringify } from "https://deno.land/std@0.171.0/encoding/yaml.ts";

// (Intentionally no browser libraries here; server-side code should not pull
// them in. Three.js is re-exported from `deps_client.ts` for the browser
// bundle only.)
