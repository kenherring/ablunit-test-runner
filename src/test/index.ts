/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-console */
import * as path from 'path'
import { GlobSync } from 'glob'
import { workspace } from 'vscode'
import { getTestConfig } from './createTestConfig'
import { setupMocha, setupNyc } from './runTestUtils'

const file = 'index.ts'

async function runTestsForProject (projName: string, timeout: number) {
	console.log('[' + file + ' runTestsForProject] projName=' + projName)
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, '..')

	console.log('[' + file + ' runTestsForProject] testsRoot=' + testsRoot)
	const files = new GlobSync('**/' + projName + '.test.js', { cwd: testsRoot })
	console.log('[' + file + ' runTestsForProject] pattern=**/' + projName + '.test.js, file.found.length=' + files.found.length + ' ' + files.found[0])
	for(const f of files.found) {
		console.log('[' + file + ' runTestsForProject] mocha.addFile ' + path.resolve(testsRoot, f) + ' ' + testsRoot + ' ' + f)
		mocha.addFile(path.resolve(testsRoot, f))
	}

	const prom = new Promise<void>((c, e) => {
		try {
			// Run the mocha test
			console.log('500')
			mocha.run((failures) => {
				console.log('501')
				if (failures > 0) {
					console.log('502')
					console.log('[' + file + ' runTestsForProject] ' + failures + ' tests failed.')
					console.log('503')
					e(new Error(failures + ' tests failed.'))
				}
				console.log('504')
				c()
			})
		} catch (err) {
			console.error('[' + file + ' runTestsForProject]  catch err= ' + err)
			if (err instanceof Error) {
				e(err)
			}
			e(new Error('non error type:' + err + ', typeof=' + typeof err))
		}
	})

	console.log('600')
	await prom
	console.log('601')

	console.log('[' + file + ' runTestsForProject] outputting coverage...')
	nyc.writeCoverageFile()
	await nyc.report().then(() => {
		console.log('[' + file + ' runTestsForProject] nyc.report() successful')
	}, (err: Error) => {
		console.error('[' + file + ' runTestsForProject] nyc.report() err=' + err)
		// e(err)
	})
	console.log('[' + file + ' runTestsForProject] coverage outputted successfully!')
}

export function run (): Promise <void> {

	let projName: string
	if (process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']) {
		projName = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']
		console.log('[' + file + ' run] projName=' + projName + ' (from env)')
	} else if (workspace.workspaceFile) {
		projName = workspace.workspaceFile.fsPath
		console.log('[' + file + ' run] projName=' + projName + ' (from workspaceFile)')
	} else if (workspace.workspaceFolders) {
		projName = workspace.workspaceFolders[0].uri.fsPath
		console.log('[' + file + ' run] projName=' + projName + ' (from workspaceFolders)')
	} else {
		throw new Error('[' + file + ' run] No workspace file or folder found')
	}

	projName = projName.replace(/\\/g, '/').split('/').reverse()[0].replace('.code-workspace', '')
	projName = projName.split('_')[0]

	// const configFilename = findConfigFile()
	// const testConfig: ITestConfig[] = JSON.parse(fs.readFileSync(configFilename, 'utf8'))
	// const config = createTestConfig().find((config: ITestConfig) => { return config.projName === projName})
	console.log('300')
	const testConfig = getTestConfig()
	console.log('301 length=' + testConfig.length + ', testConfig=' + JSON.stringify(testConfig, null, 2))
	const config = testConfig.filter((config) => { return config.projName === projName})[0]
	console.log('302 config=' + JSON.stringify(config, null, 2))
	if (!config) {
		throw new Error('[' + file + ' run] Could not find config for project ' + projName)
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	return runTestsForProject(projName, config.mocha.timeout)
}
