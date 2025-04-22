import { build, stop } from 'https://deno.land/x/esbuild@v0.17.19/mod.js';
const result = await build({
  entryPoints: ['app.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
});
for (const file of result.outputFiles) {
  console.log('file', file.path, file.text ? file.text.slice(0,100) : new TextDecoder().decode(file.contents).slice(0,100));
}
stop();
