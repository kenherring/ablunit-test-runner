import * as fs from 'fs'
import path from 'path'
import { createLaunchArgs } from './runTestUtils'
import { GlobSync } from 'glob'

// /* ********** Notes **********
// /* This file generates '.vscode-test.config.json'
// /*
// /* The generated file is used by these programs:
// /* - .vscode-test.js
// /* - src/test/runTest.ts
// /*
// /* Run:    `node ./out/test/createTestConfig.js`
// /* ********** End Notes ********** */

// disable console output when running via the extension-test-runner
let consoleEnabled = false
const outputDebugFiles = false

export interface ITestConfig {
	projName: string
	label: string
	files: string
	workspaceFolder: string,
	mocha: {
		ui: string
		timeout: number
	}
	launchArgs: string[],
	version: 'stable' | 'insiders',
	env: { [key: string]: string | undefined }
}

function log (message: string) {
	if (consoleEnabled) {
		// eslint-disable-next-line no-console
		console.log(message)
	}
}

function createTestConfigJson (version: 'stable' | 'insiders', projName: string, testFile: string, workspaceFolder?: string, timeout?: number) {
	if (!workspaceFolder) {
		workspaceFolder = './test_projects/' + projName
	}
	let searchProj = projName
	if (projName.startsWith('proj7')) {
		searchProj = 'proj7'
	}

	const g = new GlobSync(searchProj + '*', { cwd: './test_projects' })
	if (g.found.length === 1) {
		workspaceFolder = './test_projects/' + g.found[0]
	}
	if (! fs.existsSync(workspaceFolder)) {
		log('skipping config create for ' + projName + ', workspaceFolder=' + workspaceFolder + ' does not exist')
		return
	}

	if (!timeout || timeout == 0) {
		timeout = 15000
	}

	const retVal: ITestConfig = {
		projName: projName,
		label: 'extension tests - ' + projName,
		files: testFile,
		workspaceFolder: workspaceFolder,
		mocha: {
			ui: 'tdd',
			timeout: timeout
		},
		launchArgs: createLaunchArgs(version, projName, workspaceFolder),
		version: version,
		env: {
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName
		}
	}

	return retVal
}

export function createTestConfigForVersion (version: 'stable' | 'insiders') {
	const testConfig: ITestConfig[] = []


	const g = new GlobSync('**/*.test.js', { cwd: '.' })
	if (g.found.length === 0) {
		throw new Error('No test files found')
	}
	for (const f of g.found) {
		let maxTimeout = 15000
		const projName = f.replace('.test.js', '').split('/').reverse()[0]
		if (projName.startsWith('proj7A') || testConfig.length === 0) {
			maxTimeout = 60000
		}
		const conf = createTestConfigJson(version, projName, f, undefined, maxTimeout)
		if (conf) {
			testConfig.push(conf)
		}
	}

	if (outputDebugFiles) {
		let outputfile = './.vscode-test.config.json'
		if (version === 'insiders') {
			outputfile = './.vscode-test.config.insiders.json'
		}
		fs.writeFileSync(outputfile, JSON.stringify(testConfig, null, 4) + '\n')
		log('created ' + outputfile + ' succesfully!')
	}
	return testConfig
}

export function createTestConfig () {
	log('creating test config...')
	const returnConfig = createTestConfigForVersion('stable')
	createTestConfigForVersion('insiders')
	// log('created both test config files succesfully!')
	log('returning test config...')
	return returnConfig
}

if (require.main === module) {
	consoleEnabled = true
	createTestConfig()
}
