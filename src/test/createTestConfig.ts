import * as fs from 'fs'
import { GlobSync } from 'glob'
import path from 'path'

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
const consoleEnabled = false
const outputDebugFiles = false

export interface ITestConfig {
	projName: string
	label: string
	files: string
	workspaceFolder: string
	extensionDevelopmentPath: string
	extensionTestsPath: string
	mocha: {
		ui: string
		timeout: number
	}
	launchArgs: string[]
	version: 'stable' | 'insiders'
	env: { [key: string]: string | undefined }
}

function log (message: string) {
	if (consoleEnabled) {
		// eslint-disable-next-line no-console
		console.debug(message)
	}
}

function getLaunchArgs (version: 'stable' | 'insiders', projName: string, projDir: string, devPath?: string, testsPath?: string) {
	const launchArgs: string[] = [projDir]
	launchArgs.push('--log=debug')
	// launchArgs.push('--disable-gpu')
	// launchArgs.push('--trace-deprecation')
	if (devPath) {
		launchArgs.push('--extensionDevelopmentPath=' + devPath)
	}
	if (testsPath) {
		launchArgs.push('--extensionTestsPath=' + testsPath)
	}
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

function getConfigForProject (version: 'stable' | 'insiders', projName: string, testFile: string) {
	let searchProj = projName
	if (projName.startsWith('proj7')) {
		searchProj = 'proj7'
	}

	log('path = ' + path.resolve(__dirname, '../../test_projects'))
	const g = new GlobSync(searchProj + '*', { cwd: path.resolve(__dirname, '../../test_projects') })
	log('g.found.length=' + g.found.length)
	let workspaceFolder = projName
	if (g.found.length === 1) {
		workspaceFolder = path.resolve(__dirname, '../../test_projects/', g.found[0])
		log('workspaceFolder = ' + workspaceFolder)
	} else if (g.found.length === 0) {
		log('skipping config create for ' + projName + ', no workspaceFolder found (path=' + workspaceFolder + ')')
		return
	} else if (g.found.length > 1) {
		log('skipping config create for ' + projName + ', multiple workspaceFolders found (path=' + workspaceFolder + ')')
		return
	}
	log('pathexist? path=' + path.resolve(__dirname, '../../test_projects/', workspaceFolder))
	if (! fs.existsSync(path.resolve(__dirname, '../../test_projects', workspaceFolder))) {
		log('skipping config create for ' + projName + ', does not exist (path=' + workspaceFolder + ')')
		return
	}

	let timeout = 15000
	if (projName.startsWith('proj7A')) {
		timeout = 60000
	}

	const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname)

	const retVal: ITestConfig = {
		projName: projName,
		label: 'extension tests - ' + projName,
		files: testFile,
		workspaceFolder: workspaceFolder,
		extensionDevelopmentPath: extensionDevelopmentPath,
		extensionTestsPath: extensionTestsPath,
		mocha: {
			ui: 'tdd',
			timeout: timeout
		},
		launchArgs: getLaunchArgs(version, projName, workspaceFolder, extensionDevelopmentPath, extensionTestsPath),
		version: version,
		env: {
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName,
			ABLUNIT_TEST_RUNNER_VSCODE_VERSION: version
		}
	}

	log('retVal = ' + JSON.stringify(retVal, null, 2))

	return retVal
}

export function createConfigForVersion (version: 'stable' | 'insiders') {
	log('creating test config for version \'' + version + '\'...')
	const testConfig: ITestConfig[] = []

	const g = new GlobSync('**/*.test.js', { cwd: path.resolve(__dirname, '../../') })
	if (g.found.length === 0) {
		throw new Error('No test files found')
	}
	for (const f of g.found) {
		log('g.found = ' + f)
		const projName = f.replace('.test.js', '').split('/').reverse()[0]
		log('projName = ' + projName)

		log('400 - getConfigForProject')
		const conf = getConfigForProject(version, projName, f)
		log('401 - getConfigForProject')
		if (conf) {
			log('402 - getConfigForProject - conf.projName=' + conf.projName)
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

export const testConfigStable = createConfigForVersion('stable')
export const testConfigInsiders = createConfigForVersion('insiders')

export function getTestConfig (version: 'stable' | 'insiders' = 'stable') {
	if (version === 'insiders') {
		return testConfigInsiders
	}
	return testConfigStable
}

// export function getTestConfig (version: 'stable' | 'insiders' = 'stable') {
// 	log('creating test config...')
// 	const returnConfigStable = createConfigForVersion('stable')
// 	const returnConfigInsiders = createConfigForVersion('insiders')
// 	// log('created both test config files succesfully!')
// 	log('returning test config for version \'' + version + '\'...')
// 	if (version === 'insiders') {
// 		return returnConfigInsiders
// 	}
// 	return returnConfigStable
// }

// console.debug('[' + __filename + '] starting... (require.main=' + JSON.stringify(require.main) + ')')
// if (require.main === module) {
// 	console.debug('[' + __filename + '] require.main === module')
// 	consoleEnabled = true
// 	createTestConfig()
// } else {

// }
