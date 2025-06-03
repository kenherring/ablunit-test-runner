const esbuild = require('esbuild')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

let logtag = '[build]'
if (watch) {
    logtag = '[watch]'
}

async function main () {
	const ctx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: 'both',
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin
		]
	})
	if (watch) {
        console.log(logtag + ' watching...')
		await ctx.watch()
	} else {
		await ctx.rebuild()
		await ctx.dispose()
	}
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup (build) {
		build.onStart(() => {
			console.log(logtag + ' build started')
		})
		build.onEnd(result => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`)
                if (location) {
				    console.error(`    ${location.file}:${location.line}:${location.column}:`)
                } else {
                    console.error('    location unknown')
                }
			})
			console.log(logtag + ' build finished')
		})
	}
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
