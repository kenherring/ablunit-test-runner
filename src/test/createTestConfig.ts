import * as fs from 'fs'
import { GlobSync } from 'glob'
import path from 'path'

// /* ********** Notes **********
// /* This file generates config for testing at runtime
// /* ********** End Notes ********** */

// disable console output when running via the extension-test-runner
const consoleEnabled = false
const outputDebugFiles = true

export interface ITestConfig {
	projName: string
	label: string
	files: string
	newWindow?: boolean
	workspaceFolder: string
	extensionDevelopmentPath: string
	extensionTestsPath: string
	version: 'stable' | 'insiders'
	mocha: {
		ui: string
		retries?: number
		timeout: number
	}
	launchArgs: string[]
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
	// launchArgs.push('--crash-reporter-directory=/Users/brian/Code/vscode/.build/crashes')
	// launchArgs.push('--disable-extensions')
	launchArgs.push('--disable-gpu')
	launchArgs.push('--disable-telemetry')
	launchArgs.push('--disable-updates')
	// launchArgs.push('--disable-workspace-trust')
	launchArgs.push('--log=debug')
	// launchArgs.push('--logsPath=./artifacts/logs')
	launchArgs.push('--no-cached-data')
	launchArgs.push('--skip-release-notes')
	launchArgs.push('--skip-welcome')
	// launchArgs.push('--trace-deprecation')
	// launchArgs.push('--use-inmemory-secretstorage')
	launchArgs.push('--install-extension=riversidesoftware.openedge-abl-lsp')

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
	if (projName === 'DebugLines' || projName.startsWith('proj7A')) {
		timeout = 60000
	}

	const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	const extensionTestsPath = path.resolve(__dirname)

	const retVal: ITestConfig = {
		projName: projName,
		label: 'extension tests - ' + projName,
		files: testFile,
		// newWindow: true,
		workspaceFolder: workspaceFolder,
		extensionDevelopmentPath: extensionDevelopmentPath,
		extensionTestsPath: extensionTestsPath,
		mocha: {
			ui: 'tdd',
			retries: 1,
			timeout: timeout
		},
		launchArgs: getLaunchArgs(version, projName, workspaceFolder),
		// launchArgs: getLaunchArgs(version, projName, workspaceFolder, extensionDevelopmentPath, extensionTestsPath),
		version: version,
		env: {
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName,
			ABLUNIT_TEST_RUNNER_VSCODE_VERSION: version,
			// VSCODE_SKIP_PRELAUNCH: 1
		}
	}

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
		const projName = f.replace('.test.js', '').split('/').reverse()[0]
		// if (projName === 'DebugLines') {
		// 	continue
		// }
		const conf = getConfigForProject(version, projName, f)
		if (conf) {
			testConfig.push(conf)
		}
	}

	if (outputDebugFiles) {
		let outputfile = '.vscode-test.config.json'
		if (version === 'insiders') {
			outputfile = '.vscode-test.config.insiders.json'
		}

		outputfile = './' + outputfile

		outputfile = './artifacts/' + outputfile
		if (!fs.existsSync('./artifacts')) {
			fs.mkdirSync('./artifacts')
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
