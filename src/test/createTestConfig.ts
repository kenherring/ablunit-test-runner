/* eslint-disable no-console */
import { GlobSync } from 'glob'
import * as fs from 'fs'

/* ********** Notes **********
/* This file generates '.vscode-test.config.json'
/*
/* The generated file is used by these programs:
/* - .vscode-test.js
/* - src/test/index.ts
/* - src/test/runTest.ts
/*
/* Run:    `node ./out/test/createTestConfig.js`
/* ********** End Notes ********** */

export interface ITestConfig {
	projName: string
	label: string
	files: string
	workspaceFolder: string
	mocha: {
		ui: string
		timeout: number
	}
	launchArgs: string[],
	version: 'insiders' | 'stable',
	env: { [key: string]: string | undefined }
}

function createLaunchArgs (projName: string, version: 'stable' | 'insiders') {
	const launchArgs: string[] = []
	launchArgs.push('--log=debug')
	// launchArgs.push('--disable-gpu')
	// launchArgs.push('--trace-deprecation')
	if (version === 'insiders') {
		launchArgs.push('--enable-proposed-api=kherring.ablunit-test-runner')
	}
	if (projName != 'DebugLines' &&
		projName != 'proj3' &&
		projName != 'proj4' &&
		projName != 'proj7A' &&
		projName != 'proj7B' &&
		projName != 'proj9' &&
		projName != 'projA') {
		launchArgs.push('--disable-extensions')
	}
	return launchArgs
}

function createTestConfig (version: 'stable' | 'insiders', projName: string, testFile: string, workspaceFolder?: string, timeout?: number) {
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
		console.log('skipping config create for ' + projName + ', workspaceFolder=' + workspaceFolder + ' does not exist')
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
		launchArgs: createLaunchArgs(projName, version),
		version: version,
		env: {
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName
		}
	}

	return retVal
}

export function getTestConfig () {
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
		const conf = createTestConfig('stable', projName, f, undefined, maxTimeout)
		if (conf) {
			testConfig.push(conf)
		}
	}
	fs.writeFileSync('./.vscode-test.config.json', JSON.stringify(testConfig, null, 4) + '\n')
	console.log('created ./.vscode-test.config.json succesfully!')

	for (const t of testConfig) {
		t.version = 'insiders'
		t.launchArgs = createLaunchArgs(t.projName, t.version)
	}
	fs.writeFileSync('./.vscode-test.config.insiders.json', JSON.stringify(testConfig, null, 4) + '\n')
	console.log('created ./.vscode-test.config.insiders.json succesfully!')
}

console.log('creating test config...')
getTestConfig()
console.log('created both test config files succesfully!')
