require('esbuild').build({
	entryPoints: [
		'./src/**/*.ts'
	],
	outdir: 'out',
	platform: 'node',
	format: 'cjs',
	sourcemap: true
})
