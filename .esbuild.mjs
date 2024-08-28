import * as esbuild from 'esbuild'

await esbuild.build({
    entryPoints: ['src/extension.ts'],
    tsconfig: './tsconfig.json',
    bundle: true,
    external: ['vscode'],
    sourcemap: 'both',
    minify: true,
    platform: 'node',
    outdir: 'dist',
    sourceRoot: './',
})
