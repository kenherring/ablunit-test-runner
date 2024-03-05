import * as fs from 'fs'
import { globSync } from 'glob'
import { MochaOptions } from 'mocha'
import path from 'path'
import { vscodeVersion } from '../ABLUnitCommon'

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
	mocha: MochaOptions
	launchArgs: string[]
	env: { [key: string]: string | undefined }
}

function log (message: string) {
	if (consoleEnabled) {
		// eslint-disable-next-line no-console
		console.debug(message)
	}
}

function getLaunchArgs (version: vscodeVersion, projName: string, projDir: string, devPath?: string, testsPath?: string) {
	const launchArgs: string[] = [projDir]
	// launchArgs.push('--crash-reporter-directory=/Users/brian/Code/vscode/.build/crashes')
	// launchArgs.push('--disable-extensions')
	launchArgs.push('--disable-gpu')
	launchArgs.push('--disable-telemetry')
	launchArgs.push('--disable-updates')
	// launchArgs.push('--disable-workspace-trust')
	launchArgs.push('--log=debug')
	// launchArgs.push('--logsPath=./artifacts/logs')
	// launchArgs.push('--no-cached-data')
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
	if (version === 'insiders' || version === 'proposedapi') {
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

function getConfigForProject (version: vscodeVersion, projName: string, testFile: string) {
	let searchProj = projName
	if (projName.startsWith('proj7')) {
		searchProj = 'proj7'
	}

	log('path = ' + path.resolve(__dirname, '../../test_projects'))
	const g = globSync(searchProj + '*', { cwd: path.resolve(__dirname, '../../test_projects') })
	let workspaceFolder = projName
	if (g.length === 1) {
		workspaceFolder = path.resolve(__dirname, '../../test_projects/', g[0])
		log('workspaceFolder = ' + workspaceFolder)
	} else if (g.length === 0) {
		log('skipping config create for ' + projName + ', no workspaceFolder found (path=' + workspaceFolder + ')')
		return
	} else if (g.length > 1) {
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
		timeout = 90000
	}

	const extensionDevelopmentPath: string = path.resolve(__dirname, '../../')
	const basedir = extensionDevelopmentPath
	const extensionTestsPath = path.resolve(__dirname)
	const oeVersion = process.env['OE_VERSION'] || '0.0.0'

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
			timeout: timeout,
			reporterOptions: {
				reporterEnabled: 'spec, mocha-junit-reporter, mocha-reporter-sonarqube',
				mochaJunitReporterReporterOptions: {
					mochaFile: basedir + '/artifacts/' + version + '-' + oeVersion + '/mocha_results_junit_' + projName + '.xml'
				},
				mochaReporterSonarqubeReporterOptions: {
					filename: basedir + '/artifacts/' + version + '-' + oeVersion + '/mocha_results_sonar_' + projName + '.xml'
				}
			}
		},
		launchArgs: getLaunchArgs(version, projName, workspaceFolder),
		// launchArgs: getLaunchArgs(version, projName, workspaceFolder, extensionDevelopmentPath, extensionTestsPath),
		version: 'stable',
		env: {
			ABLUNIT_TEST_RUNNER_UNIT_TESTING: 'true',
			ABLUNIT_TEST_RUNNER_PROJECT_NAME: projName,
			ABLUNIT_TEST_RUNNER_VSCODE_VERSION: version,
			// VSCODE_SKIP_PRELAUNCH: 1
		}
	}
	if (version === 'insiders') {
		retVal.version = 'insiders'
	}

	return retVal
}

function createConfigForVersion (version: vscodeVersion) {
	log('creating test config for version \'' + version + '\', cwd=' + path.resolve(__dirname, '../../') + '\'...')
	const testConfig: ITestConfig[] = []

	const g = globSync('**/*.test.js', { cwd: path.resolve(__dirname, '../../') })
	if (g.length === 0) {
		throw new Error('No test files found')
	}
	for (const f of g) {
		const projName = f.replace('.test.js', '').replace(/\\/g, '/').split('/').reverse()[0]
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

		const oeVersion = process.env['OE_VERSION'] ?? '0.0.0'
		const outputdir = './artifacts/' + version + '-' + oeVersion
		if (!fs.existsSync(outputdir)) {
			fs.mkdirSync(outputdir, { recursive: true })
		}
		outputfile = outputdir + '/' + outputfile

		fs.writeFileSync(outputfile, JSON.stringify(testConfig, null, 4) + '\n')
		log('created ' + outputfile + ' succesfully!')
	}
	return testConfig
}

// export const testConfigStable = createConfigForVersion('stable')
// export const testConfigInsiders = createConfigForVersion('proAposedapi')
// export const testConfigInsiders = createConfigForVersion('insiders')

export function getTestConfig (version: vscodeVersion) {
	return createConfigForVersion(version)
}
