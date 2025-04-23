import { serve } from "https://deno.land/std@0.171.0/http/server.ts";
import { serveFile } from "https://deno.land/std@0.171.0/http/file_server.ts";
// ESBuild bundler for frontend
import { build } from "https://deno.land/x/esbuild@v0.17.19/mod.js";

console.log("Server running on http://localhost:8000");
serve(async (req) => {
  const url = new URL(req.url);
  let path = url.pathname;
  // Suppress favicon requests
  if (path === "/favicon.ico") {
    return new Response(null, { status: 204 });
  }
  if (path === "/") path = "/index.html";
  // Bundle and serve client TypeScript modules as /bundle.js
  if (path === "/bundle.js") {
    try {
      const result = await build({
        entryPoints: ["app.ts"],
        bundle: true,
        write: false,
        platform: "browser",
        format: "esm",
      });
      const output = result.outputFiles[0];
      const jsCode = new TextDecoder().decode(output.contents);
      return new Response(jsCode, {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    } catch (err) {
      console.error("Bundling error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
  try {
    const filePath = `.${path}`;
    return await serveFile(req, filePath);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}, {
  hostname: "0.0.0.0",
  port: 8000
});