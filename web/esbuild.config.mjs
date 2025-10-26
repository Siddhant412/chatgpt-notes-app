import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

await build({
    entryPoints: ['src/main.tsx'],
    outfile: 'dist/notes.js',
    bundle: true,
    format: 'esm',
    sourcemap: true,
    minify: !watch,
    define: { 'process.env.NODE_ENV': '"production"' }
});