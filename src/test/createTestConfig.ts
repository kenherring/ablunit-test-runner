import { GlobSync } from 'glob'
import { formatWithOptions } from 'util'
import * as fs from 'fs'

/* ********** Notes **********
/* This file generates '.vscode-test.config.json'
/*
/* The generated file is used by these programs:
/* - .vscode-test.js
/* - src/test/index.ts
/* - src/test/runTest.ts
/*
/* Build:  `npm run build-tsc`
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
	env: { [key: string]: string | undefined }
}

function createTestConfig (projName: string, workspaceFolder?: string, timeout?: number) {
	if (!workspaceFolder) {
		workspaceFolder = projName
	}

	const g = new GlobSync(projName + '*', { cwd: './test_projects' })
	if (g.found.length === 1) {
		workspaceFolder = g.found[0]
	}

	if (!timeout || timeout == 0) {
		timeout = 15000
	}

	const launchArgs: string[] = []
	if (projName != "DebugLines" &&
		projName != "proj3" &&
		projName != "proj4" &&
		projName != "proj9" &&
		projName != "projA") {
		launchArgs.push('--disable-extensions')
	}

	const retVal: ITestConfig = {
		projName: projName,
		label: 'extension tests - ' + projName,
		files: 'out/test/**/*' + projName + '.test.js',
		workspaceFolder: './test_projects/' + workspaceFolder,
		mocha: {
			ui: 'tdd',
			timeout: timeout
		},
		launchArgs: launchArgs,
		env: {
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName
		}
	}

	return retVal
}

export function getTestConfig () {
	const testConfig: ITestConfig[] = []

	const g = new GlobSync('**/*.test.ts', { cwd: '.' })
	if (g.found.length === 0) {
		throw new Error('No test files found')
	}
	for (const f of g.found) {
		let maxTimeout = 15000
		const projName = f.replace('.test.ts', '').split('/').reverse()[0]
		console.log('projName=' + projName + ", f=" + f)
		if (projName === 'proj7') {
			maxTimeout = 60000
		}
		testConfig.push(createTestConfig(projName, undefined, maxTimeout))
	}
	fs.writeFileSync('./.vscode-test.config.json', formatWithOptions({ colors: true }, JSON.stringify(testConfig, null, 4)))
	console.log('created .vscode-test.config.json succesfully!')
	return testConfig
}

getTestConfig()
