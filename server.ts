import { serve, serveFile, build, parse, stringify } from "./deps.ts";

// Load environment variables from .env file into Deno.env
try {
  const envText = await Deno.readTextFile('.env');
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    Deno.env.set(key, val);
  }
} catch (err) {
  console.error('Failed to load .env file:', err);
}

console.log("Server running on http://localhost:8000");
serve(async (req) => {
  const url = new URL(req.url);
  let path = url.pathname;
  // High-scores API: fetch top 3 via GET, submit new via POST
  if (path === "/api/high-scores") {
    if (req.method === "GET") {
      // Ensure level field exists (default to 1)
      let scores: Array<any> = [];
      try {
        const yml = await Deno.readTextFile("high-scores.yml");
        const parsed = parse(yml);
        if (Array.isArray(parsed)) scores = parsed as any;
      } catch {}
      scores = scores.map((s: any) => ({ name: s.name, score: s.score, level: typeof s.level === 'number' ? s.level : 1 }));
      console.log("[DEBUG] server: GET /api/high-scores, returning scores with levels:", JSON.stringify(scores));
      return new Response(JSON.stringify(scores), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (req.method === "POST") {
      // Require valid API key for write access
      const apiKey = req.headers.get('x-api-key') || '';
      const expectedKey = Deno.env.get('HIGH_SCORES_TOKEN') || '';
      if (!expectedKey || apiKey !== expectedKey) {
        return new Response('Unauthorized', { status: 401 });
      }
      let payload: any;
      try { payload = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
      console.log("[DEBUG] server: received POST /api/high-scores with payload:", JSON.stringify(payload));
      const { name, score, level } = payload;
      if (typeof name !== "string" || typeof score !== "number" || typeof level !== "number") {
        return new Response("Invalid data", { status: 400 });
      }
      // Load existing top scores
      let scores: Array<any> = [];
      try {
        const yml = await Deno.readTextFile("high-scores.yml");
        const parsed = parse(yml);
        if (Array.isArray(parsed)) scores = parsed as any;
      } catch {}
      console.log("[DEBUG] server: existing high-scores before update:", JSON.stringify(scores));
      // Update or insert player's score and level
      const existingIndex = scores.findIndex(s => s.name === name);
      if (existingIndex >= 0) {
        // Only overwrite if new score is higher
        if (score > scores[existingIndex].score) {
          scores[existingIndex].score = score;
          scores[existingIndex].level = level;
        }
      } else {
        scores.push({ name, score, level });
      }
      // Sort and retain top 3
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 3);
      // Persist updated high-scores
      try {
        console.log("[DEBUG] server: persisting updated high-scores with data:", JSON.stringify(scores));
        await Deno.writeTextFile("high-scores.yml", stringify(scores as unknown as Record<string, unknown>[]));
        console.log("[DEBUG] server: successfully wrote high-scores.yml");
      } catch (err) {
        console.error("Failed to write high-scores.yml:", err);
      }
      return new Response(JSON.stringify(scores), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("Method Not Allowed", { status: 405 });
  }
  // Suppress favicon requests
  if (path === "/favicon.ico") {
    return new Response(null, { status: 204 });
  }
  if (path === "/") path = "/index.html";
  // Bundle and serve client TypeScript modules as /bundle.js
  if (path === "/bundle.js") {
    try {
      // Bundle and inject URL from environment
      const result = await build({
        entryPoints: ["app.ts"],
        bundle: true,
        write: false,
        platform: "browser",
        format: "esm",
        define: {
          // Replace process.env.URL with actual URL from .env
          'process.env.URL': JSON.stringify(Deno.env.get('URL') || ''),
          // Replace process.env.HIGH_SCORES_TOKEN for client POST auth
          'process.env.HIGH_SCORES_TOKEN': JSON.stringify(Deno.env.get('HIGH_SCORES_TOKEN') || ''),
        },
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