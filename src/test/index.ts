/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-console */
import * as path from 'path'
import { globSync } from 'glob'
import { workspace } from 'vscode'
import { getTestConfig } from './createTestConfig'
import { setupMocha, setupNyc } from './runTestUtils'
import { log } from 'console'
import { vscodeVersion } from 'ABLUnitCommon'

const file = 'index.ts'

async function runTestsForProject (version: vscodeVersion, projName: string, timeout: string | number | undefined) {
	console.log('[' + file + ' runTestsForProject] projName=' + projName)
	const nyc = setupNyc(version, projName)
	const mocha = setupMocha(version, projName, path.resolve(__dirname, '..', '..'), timeout)
	const testsRoot = path.resolve(__dirname, '..')

	console.log('[' + file + ' runTestsForProject] testsRoot=' + testsRoot)
	const files = globSync('**/' + projName + '.test.js', { cwd: testsRoot })
	console.log('[' + file + ' runTestsForProject] pattern=**/' + projName + '.test.js, file.found.length=' + files.length + ' ' + files[0])
	for(const f of files) {
		console.log('[' + file + ' runTestsForProject] mocha.addFile ' + path.resolve(testsRoot, f) + ' ' + testsRoot + ' ' + f)
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
	let version: vscodeVersion = 'stable'
	log('[' + file + ' run] ABLUNIT_TEST_RUNNER_VSCODE_VERSION=' + process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'])
	if (process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']) {
		if (process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION']) {
			version = process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] as vscodeVersion
		} else if (process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] !== 'stable') {
			throw new Error('[' + file + ' run] ABLUNIT_TEST_RUNNER_VSCODE_VERSION=' + process.env['ABLUNIT_TEST_RUNNER_VSCODE_VERSION'] + ' (from env) is not supported')
		}
	}
	console.log('[' + file + ' run] version=' + version + ' (from env)')

	projName = projName.replace(/\\/g, '/').split('/').reverse()[0].replace('.code-workspace', '')
	projName = projName.split('_')[0]

	const testConfig = getTestConfig(version)
	const config = testConfig.filter((config) => { return config.projName === projName})[0]
	if (!config) {
		throw new Error('[' + file + ' run] Could not find config for project ' + projName)
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	return runTestsForProject(version, projName, config.mocha.timeout)
}
