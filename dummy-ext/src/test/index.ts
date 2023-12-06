import * as path from "path"
import * as Mocha from "mocha"

function setupMocha(projName: string, timeout: number) {
	return new Mocha({
		color: true,
		ui: "tdd",
		timeout: timeout,
		// reporter: 'mocha-junit-reporter',
		// reporterOptions: {
		// 	mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
		// }
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				mochaFile: 'artifacts/mocha_results_' + projName + '.xml'
			}
		}
	})
}

export function run(): Promise <void> {
	const testsRoot = path.resolve(__dirname, "..")
	const mocha = setupMocha('installAndRun', 10000)
	return new Promise<void>((c, e) => {
		mocha.addFile(path.resolve(testsRoot, './test/installAndRun.test.js'))
		try {
			// Run the mocha test
			mocha.run(async (failures) => {
				if (failures > 0) {
					console.log(`${failures} tests failed.`)
					e(new Error(`${failures} tests failed.`))
				}
				console.log("all test(s) passed!")
				c()
			})
		} catch (err) {
			console.error('[index.ts] catch err= ' + err)
			e(err)
		}
	})
}
