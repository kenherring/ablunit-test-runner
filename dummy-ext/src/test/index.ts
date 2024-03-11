import * as path from 'path'
import Mocha from 'mocha'

type vscodeVersion = 'stable' | 'insiders' | 'proposedapi'

function setupMocha(version: vscodeVersion, projName: string, basedir: string, timeout: number) {
	const oeVersion = process.env['ABLUNIT_TEST_RUNNER_OE_VERSION'] || '0.0.0'
	return new Mocha({
		color: true,
		ui: "tdd",
		timeout: timeout,
		reporter: 'mocha-multi-reporters',
		reporterOptions: {
			reporterEnabled: 'spec, mocha-junit-reporter, mocha-reporter-sonarqube',
			mochaJunitReporterReporterOptions: {
				mochaFile: basedir + '/artifacts/' + version + '-' + oeVersion + '/mocha_results_junit_' + projName + '.xml'
			},
			mochaReporterSonarqubeReporterOptions: {
				filename: basedir + '/artifacts/' + version + '-' + oeVersion + '/mocha_results_sonar_' + projName + '.xml',
				useFullFilePath: 'true'
			}
		}
	})
}

export function run(): Promise <void> {
	const testsRoot = path.resolve(__dirname, '..')
	const mocha = setupMocha('stable', 'installAndRun', path.resolve(__dirname, '..', '..'), 15000)
	return new Promise<void>((c, e) => {
		mocha.addFile(path.resolve(testsRoot, './test/installAndRun.test.js'))
		try {
			// Run the mocha test
			mocha.run(async (failures) => {
				if (failures > 0) {
					console.log(`${failures} tests failed.`)
					e(new Error(`${failures} tests failed.`))
					return
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
