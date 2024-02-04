/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-console */
import { GlobSync } from 'glob'
import { workspace } from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { ITestConfig } from './createTestConfig.js'
import { setupMocha, setupNyc } from './runTestUtils.js'

const file = 'index.ts'

async function runTestsForProject (projName: string, timeout: number) {
	console.log('[' + file + ' runTestsForProject] projName=' + projName)
	const nyc = setupNyc(projName)
	const mocha = setupMocha(projName, timeout)
	const testsRoot = path.resolve(__dirname, '..')

	console.log('[' + file + ' runTestsForProject] testsRoot=' + testsRoot)
	const files = new GlobSync('**/' + projName + '.test.js', { cwd: testsRoot })
	console.log('[' + file + ' runTestsForProject] pattern=**/' + projName + '.test.js, file.found.length=' + files.found.length)
	for(const f of files.found) {
		console.log('[' + file + ' runTestsForProject] mocha.addFile ' + path.resolve(testsRoot, f))
		mocha.addFile(path.resolve(testsRoot, f))
	}

	const prom = new Promise<void>((c, e) => {
		try {
			// Run the mocha test
			mocha.run((failures) => {
				if (failures > 0) {
					console.log('[' + file + ' runTestsForProject] ' + failures + ' tests failed.')
					e(new Error(failures + ' tests failed.'))
				}
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

	await prom

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

function findConfigFile () {
	// search up to 5 levels back for .vscode-test.config.json
	let configFilename = './.vscode-test.config.json'
	for (let i = 0; i < 5; i++) {
		if (fs.existsSync(configFilename)) {
			return configFilename
		}
		configFilename = '../' + configFilename
	}
	throw new Error('[' + file + ' findConfigFile] Could not find .vscode-test.config.json')
}

export function run (): Promise <void> {

	let proj: string
	if (process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']) {
		proj = process.env['ABLUNIT_TEST_RUNNER_PROJECT_NAME']
	} else if (workspace.workspaceFile) {
		proj = workspace.workspaceFile.fsPath
	} else if (workspace.workspaceFolders) {
		proj = workspace.workspaceFolders[0].uri.fsPath
	} else {
		throw new Error('[' + file + ' run] No workspace file or folder found')
	}

	proj = proj.replace(/\\/g, '/').split('/').reverse()[0].replace('.code-workspace', '')
	proj = proj.split('_')[0]

	const configFilename = findConfigFile()
	const testConfig: ITestConfig[] = JSON.parse(fs.readFileSync(configFilename, 'utf8'))
	const config = testConfig.filter((config: ITestConfig) => { return config.projName === proj })[0]
	if (!config) {
		throw new Error('[' + file + ' run] Could not find config for project ' + proj)
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	return runTestsForProject(proj, config.mocha.timeout)
}
