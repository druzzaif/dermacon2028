// Library build for Next.js: ESM module exporting createVenue, ROOMS, findRoom. three stays external (install `three` in the app).
import { build } from 'esbuild';
await build({ entryPoints: ['src/index.js'], bundle: true, format: 'esm', external: ['three'], outfile: 'dist/lib/dermacon-venue.mjs', target: 'es2020', legalComments: 'none', minify: true });
console.log('lib built');
