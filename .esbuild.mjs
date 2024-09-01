import * as esbuild from 'esbuild'


/** @type {import('esbuild').BuildOptions} */
const buildOpts = {
    entryPoints: ['src/extension.ts'],
    // tsconfig: '//tsconfig.json',
    bundle: true,
    external: ['vscode'],
    sourcemap: 'both',
    minify: true,
    platform: 'node',
    outfile: 'dist/extension.js',
    // sourceRoot: '.',
	// metafile: true,
	plugins: [{
		name: 'rebuild-notify',
		setup(build) {
			build.onEnd(result => {
				console.log(`build ended with ${result.errors.length} errors`);
				// HERE: somehow restart the server from here, e.g., by sending a signal that you trap and react to inside the server.
			})
		},
	}],
}

const run = async () => {
	const ctx = await esbuild.context(config);
	await ctx.watch();
  };

esbuild.build(buildOpts)
console.log('esbuild success')

// if (process.argv.includes('--watch')) {
// 	esbuild.build({
// 		entryPoints: ['src/extension.ts'],
// 		tsconfig: './tsconfig.json',
// 		bundle: true,
// 		external: ['vscode'],
// 		sourcemap: 'both',
// 		minify: true,
// 		platform: 'node',
// 		outfile: 'dist/extension.js',
// 		// sourceRoot: '.',
// 	})
// }
