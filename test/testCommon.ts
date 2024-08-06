import * as assertParent from 'assert'
import * as fs from 'fs'
import { globSync } from 'glob'
import * as vscode from 'vscode'
import {
	CancellationError, TestController,
	TestItemCollection,
	Uri,
	Selection,
	WorkspaceFolder, commands, extensions, window,
	workspace
} from 'vscode'
import { ABLResults } from '../src/ABLResults'
import { Duration, deleteFile as deleteFileCommon, isRelativePath, readStrippedJsonFile } from '../src/ABLUnitCommon'
import { log as logObj } from '../src/ChannelLogger'
import { IExtensionTestReferences } from '../src/extension'
import { ITestSuites } from '../src/parse/ResultsParser'
import { IConfigurations, parseRunProfiles } from '../src/parse/TestProfileParser'
import { DefaultRunProfile, IRunProfile as IRunProfileGlobal } from '../src/parse/config/RunProfile'
import { RunStatus } from '../src/ABLUnitRun'
import { enableOpenedgeAblExtension, rebuildAblProject, restartLangServer, setRuntimes, waitForLangServerReady } from './openedgeAblCommands'
import path from 'path'

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

// https://github.com/microsoft/vscode/blob/2aae82a102da66e566842ff9177bceeb99873970/src/vs/workbench/browser/actions/workspaceCommands.ts#L156C1-L163C2
// interface IOpenFolderAPICommandOptions {
// 	forceNewWindow?: boolean
// 	forceReuseWindow?: boolean
// 	noRecentEntry?: boolean
// 	forceLocalWindow?: boolean
// 	forceProfile?: string
// 	forceTempProfile?: boolean
// }

// runtime environment vars
export const enableExtensions = () => {
	const enableExtensions = getEnvVar('ABLUNIT_TEST_RUNNER_ENABLE_EXTENSIONS')
	if (enableExtensions) {
		return enableExtensions === 'true'
	}
	return true
}

export const oeVersion = () => {
	const oeVersionEnv = getEnvVar('ABLUNIT_TEST_RUNNER_OE_VERSION')
	log.info('oeVersionEnv=' + oeVersionEnv)
	if (oeVersionEnv?.match(/^(11|12)\.\d$/)) {
		log.info('100 oeVersionEnv=' + oeVersionEnv)
		return oeVersionEnv
	}

	const oeVersion = getEnvVar('OE_VERSION')
	log.info('oeVersion=' + oeVersion + ' ' + oeVersion?.split('.').slice(0, 2).join('.'))
	if (oeVersion?.match(/^(11|12)\.\d.\d+$/)) {
		log.info('101 oeVersionEnv=' + oeVersion.split('.').slice(0, 2).join('.'))
		return oeVersion.split('.').slice(0, 2).join('.')
	}

	const versionFile = path.join(getDefaultDLC(), 'version')
	const dlcVersion = fs.readFileSync(versionFile)
	log.info('dlcVersion=' + dlcVersion)
	if (dlcVersion) {
		const match = RegExp(/OpenEdge Release (\d+\.\d+)/).exec(dlcVersion.toString())
		if (match) {
			log.info('102 oeVersionEnv=' + match[1])
			return match[1]
		}
	}
	throw new Error('unable to determine oe version!')
	// return '12.2'
}

const getEnvVar = (envVar: string) => {
	if (process.env[envVar]) {
		return process.env[envVar]
	}
	return undefined
}

const projName = () => { return getWorkspaceUri().fsPath.replace(/\\/g, '/').split('/').pop() }

// test suite objects
export const log = logObj
export class FilesExclude {
	exclude: Record<string, boolean> = {}
}
// riversidesoftware.openedge-abl-lsp extension objects
export { setRuntimes, rebuildAblProject }
// kherring.ablunit-test-runner extension objects
export type IRunProfile = IRunProfileGlobal
export { RunStatus, parseRunProfiles }
// vscode objects
export {
	CancellationError, Duration, Selection, Uri,
	commands, extensions, window, workspace
}

// test case objects - reset before each test
let testController: TestController | undefined
let recentResults: ABLResults[] | undefined
let currentRunData: ABLResults[] | undefined
export let runAllTestsDuration: Duration | undefined
export let cancelTestRunDuration: Duration | undefined

export function beforeCommon () {
	recentResults = undefined
	testController = undefined
	currentRunData = undefined
}

log.info('enableExtensions=' + enableExtensions() + ', projName=' + projName() + ', oeVersion=' + oeVersion())

export function isoDate () {
	return ''
	// TODO remove this function
	// return '[' + new Date().toISOString() + ']'
}

function getExtensionDevelopmentPath () {
	let dir = Uri.joinPath(Uri.file(__dirname))
	if (doesFileExist(Uri.joinPath(dir, 'package.json'))) {
		return dir
	}
	dir = Uri.joinPath(Uri.file(__dirname), '..')
	if (doesFileExist(Uri.joinPath(dir, 'package.json'))) {
		return dir
	}
	dir = Uri.joinPath(Uri.file(__dirname), '..', '..')
	if (doesFileExist(Uri.joinPath(dir, 'package.json'))) {
		return dir
	}
	dir = Uri.joinPath(Uri.file(__dirname), '..', '..', '..')
	if (doesFileExist(Uri.joinPath(dir, 'package.json'))) {
		return dir
	}
	throw new Error('unable to determine extensionDevelopmentPath')
}

export async function suiteSetupCommon (runtimes: IRuntime[] = []) {
	if (!runtimes || runtimes.length === 0) {
		runtimes = [{ name: oeVersion(), path: getDefaultDLC(), default: true }]
	}
	log.info('[suiteSetupCommon] waitForExtensionActive \'kherring.ablunit-test-runner\' (projName=' + projName() + ')')
	await waitForExtensionActive()
	if (enableExtensions()) {
		await enableOpenedgeAblExtension(runtimes)
	}
	log.info('suiteSetupCommon complete!')
}

export function teardownCommon () {
	runAllTestsDuration = undefined
	cancelTestRunDuration = undefined

	testController = undefined
	recentResults = undefined
	currentRunData = undefined
}

export function suiteTeardownCommon () {
	return setRuntimes()
}

export function setFilesExcludePattern () {
	const files = new FilesExclude
	// files.exclude = workspace.getConfiguration('files', getWorkspaceUri()).get('exclude', {})
	const filesConfig = workspace.getConfiguration('files', getWorkspaceUri())
	files.exclude = filesConfig.get('exclude', {}) ?? {}
	files.exclude['**/.builder'] = true
	files.exclude['**/lbia*'] = true
	files.exclude['**/rcda*'] = true
	files.exclude['**/srta*'] = true
	if (JSON.stringify(filesConfig['exclude']) === JSON.stringify(files.exclude)) {
		log.info('files.exclude already set to ' + JSON.stringify(files.exclude))
		return Promise.resolve(true)
	}

	return filesConfig.update('exclude', files.exclude).then(() => {
		log.info('[updateFilesExcludePatterns] filesConfig.update success!')
		return true
	}, (err) => {
		log.error('[updateFilesExcludePatterns] filesConfig.update failed! err=' + err)
		throw err
	})
}

export function installExtension (extname = 'riversidesoftware.openedge-abl-lsp'): PromiseLike<boolean> {
	log.info('start process.args=' + process.argv.join(' '))
	if (extensions.getExtension(extname)) {
		log.info('extension ' + extname + ' is already installed')
		return Promise.resolve(true)
	}
	if (extname === 'riversidesoftware.openedge-abl-lsp' && ! enableExtensions()) {
		throw new Error('extensions disabed, openedge-abl-lsp cannot be installed')
	}


	log.info('installing ' + extname + ' extension...')
	const installCommand = 'workbench.extensions.installExtension'
	return commands.executeCommand(installCommand, extname)
		.then(() => {
			log.info('post install command')
			return sleep2(250)
		}).then(() => {
			log.info('get extension \'' + extname + '\'...')
			const ext = extensions.getExtension(extname)
			if (!ext) {
				throw new Error('get after install failed (undefined)')
			}
			return true
		}, (e) => {
			log.error('install failed e=' + e)
			return false
		})
}

export function deleteFile (file: Uri | string) {
	if (typeof file === 'string') {
		file = Uri.joinPath(getWorkspaceUri(), file)
	}
	deleteFileCommon(file)
}

export function sleep2 (time = 10, msg?: string | null) {
	if (msg !== null) {
		let status = 'sleeping for ' + time + 'ms'
		if (msg) {
			status = status + ' [' + msg + ']'
		}
		log.info(status)
	}
	return new Promise(resolve => setTimeout(resolve, time))
}

export function sleep (requestedTime = 25, msg?: string) {
	const time = 25
	let status = 'sleeping for ' + time + 'ms'
	if (time !== requestedTime) {
		status += ' (orig=' + requestedTime + 'ms)'
	}
	if (msg) {
		status = status + ' [' + msg + ']'
	}
	log.info(status)
	return new Promise(resolve => setTimeout(resolve, time))
}

export async function activateExtension (extname = 'riversidesoftware.openedge-abl-lsp') {
	log.info('activating ' + extname + ' extension...')
	let ext = extensions.getExtension(extname)
	if (!ext) {
		await sleep2(250, 'wait and retry getExtension')
		ext = extensions.getExtension(extname)
	}
	if (!ext) {
		throw new Error('cannot activate extension, not installed: ' + extname)
	}
	log.info('active? ' + ext.isActive)

	if (!ext.isActive) {
		log.info('ext.activate')
		await ext.activate().then(() => {
			log.info('activated ' + extname + ' extension!')
		}, (e: unknown) => { throw e })
	}
	await sleep2(250)
	if (extname === 'riversidesoftware.openedge-abl-lsp') {
		await waitForLangServerReady()
	}
	log.info('isActive=' + ext.isActive)
	return ext.isActive
}

async function waitForExtensionActive (extensionId = 'kherring.ablunit-test-runner') {
	let ext = extensions.getExtension(extensionId)

	if (!ext) {
		throw new Error('extension not installed: ' + extensionId)
	}
	if (!ext) { throw new Error(extensionId + ' is not installed') }
	if (ext.isActive) { log.info(extensionId + ' is already active'); return ext.isActive }

	ext = await ext.activate()
		.then(() => { return sleep2(250) })
		.then(() => {
			log.info('activated? ' + extensionId)
			return extensions.getExtension(extensionId)
		}, (err) => { throw new Error('failed to activate kherring.ablunit-test-runner: ' + err) })
	log.info('post-activate (ext.isActive=' + ext?.isActive + ')')
	if (!ext) { throw new Error(extensionId + ' is not installed') }

	for (let i=0; i<50; i++) {
		if (ext.isActive) {
			log.info(extensionId + ' is active! (i=' + i + ')')
			return Promise.resolve(ext.isActive)
		}
		log.info('waitied ' + (i + 1) * 100 + 'ms for extension to activate')
		await sleep2(100)
	}
	if (!ext.isActive) { throw new Error(extensionId + ' is not active') }

	log.info(extensionId + ' is active!')
	return ext.isActive
}

export function getRcodeCount (workspaceFolder?: WorkspaceFolder) {
	if (!workspaceFolder) {
		workspaceFolder = workspace.workspaceFolders?.[0]
	}
	if (!workspaceFolder) {
		throw new Error('workspaceFolder is undefined')
	}

	const g = globSync('**/*.r', { cwd: workspaceFolder.uri.fsPath })
	const fileCount = g.length
	if (fileCount >= 0) {
		return fileCount
	}
	throw new Error('fileCount is not a positive number! fileCount=' + fileCount)
}

export async function awaitRCode (workspaceFolder: WorkspaceFolder, rcodeCountMinimum = 1) {
	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	log.info('isActive=' + ext?.isActive)
	if (!ext?.isActive) {
		log.info('[awaitRCode] extension not active! (ext=' + JSON.stringify(ext) + ')')
		throw new Error('openedge-abl-lsp is not active! rcode cannot be created')
	}
	const buildWaitTime = 20

	await commands.executeCommand('abl.project.rebuild').then(() => {
		log.info('abl.project.rebuild command complete!')
		return true
	}, (e) => {
		log.error('[awaitRCode] abl.project.rebuild failed! err=' + e)
		return false
	})


	log.info('waiting up to ' + buildWaitTime + ' seconds for rcode')
	for (let i = 0; i < buildWaitTime; i++) {
		const rcodeCount = getRcodeCount(workspaceFolder)
		if (rcodeCount >= rcodeCountMinimum) {
			log.info('compile complete! rcode count = ' + rcodeCount)
			return rcodeCount
		}
		log.info('found ' + rcodeCount + ' rcode files. waiting... (' + i + '/' + buildWaitTime + ')')
		await sleep2(500)
	}

	await commands.executeCommand('abl.dumpFileStatus').then(() => { log.info('abl.dumpFileStatus complete!'); return })
	await commands.executeCommand('abl.dumpLangServStatus').then(() => { log.info('abl.dumpLangServStatus complete!'); return })
	throw new Error('rcode files not found')
}

export function getWorkspaceFolders () {
	const workspaceFolders: WorkspaceFolder[] = []
	if (!workspace.workspaceFolders) {
		throw new Error('No workspaceFolders found')
	}
	for (const workspaceFolder of workspace.workspaceFolders) {
		workspaceFolders.push(workspaceFolder)
	}
	return workspaceFolders
}

export function getWorkspaceUri () {
	// log.info('vscode.workspace.workspaceFolders.length=' + vscode.workspace.workspaceFolders?.length)
	// log.info('vscode.workspace.workspaceFolders=' + JSON.stringify(vscode.workspace.workspaceFolders))
	// log.info('vscode.workspace.workspaceFile=' + vscode.workspace.workspaceFile)
	// log.info('workspace.workspaceFolders=' + workspace.workspaceFolders)
	// log.info('workspace.workspaceFile=' + workspace.workspaceFile)

	// if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
	// 	for (let i=0; i<vscode.workspace.workspaceFolders.length; i++) {
	// 		log.info('getWorkspaceUri() workspace.workspaceFolder[' + i + ']=' + vscode.workspace.workspaceFolders[i].uri.fsPath)
	// 	}
	// }

	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		if (!vscode.workspace.workspaceFile) {
			log.error('workspace.workspaceFolders is undefined')
		} else {
			log.error('workspace.workspaceFolders has no entries')
		}
		if (vscode.workspace.workspaceFile) {
			log.info('workspace.workspaceFile=' + vscode.workspace.workspaceFile.fsPath)
			return vscode.workspace.workspaceFile
		}
		return getExtensionDevelopmentPath()
		// throw new Error('workspace.workspaceFolders is undefined or has no entries')
	}

	if (vscode.workspace.workspaceFolders.length === 1) {
		return vscode.workspace.workspaceFolders[0].uri
	}

	log.warn('workspace.workspaceFolders has more than one entry')
	return vscode.workspace.workspaceFolders[0].uri
	// throw new Error('workspace.workspaceFolders has more than one entry')
}

export const workspaceUri = () => getWorkspaceUri()

export function toUri (uri: string | Uri) {
	if (uri instanceof Uri) {
		return uri
	}

	const ws = getWorkspaceUri()
	if (!ws) {
		throw new Error('workspaceUri is null (uri=' + uri.toString() + ')')
	}

	if (isRelativePath(uri)) {
		return Uri.joinPath(ws, uri)
	}
	return Uri.file(uri)
}

function fileToString (file: Uri | string) {
	if (file instanceof Uri) {
		return file.fsPath
	}
	if (isRelativePath(file)) {
		return Uri.joinPath(getWorkspaceUri(), file).fsPath
	}
	return Uri.file(file)
}

export function doesFileExist (uri: Uri | string | undefined) {
	if (!uri) {
		log.warn('doesFileExist: uri is undefined')
		return false
	}
	try {
		const stat = fs.statSync(toUri(uri).fsPath)
		if (stat.isFile()) {
			return true
		}
	} catch {
		// do nothing - file does not exist
	}
	return false
}

export function doesDirExist (uri: Uri | string) {
	try {
		const stat = fs.statSync(toUri(uri).fsPath)
		if (stat.isDirectory()) {
			return true
		}
	} catch {
		// do nothing - file does not exist
	}
	return false
}

export function deleteTestFiles () {
	const workspaceUri = getWorkspaceUri()
	deleteFile(Uri.joinPath(workspaceUri, 'ablunit.json'))
	deleteFile(Uri.joinPath(workspaceUri, 'results.json'))
	deleteFile(Uri.joinPath(workspaceUri, 'results.xml'))
}

export function getSessionTempDir () {
	if (process.platform === 'win32') {
		return Uri.file('c:/temp/ablunit')
	}
	if(process.platform === 'linux') {
		return Uri.file('/tmp/ablunit')
	}
	throw new Error('Unsupported platform: ' + process.platform)
}

export async function getTestCount (resultsJson: Uri, status = 'tests') {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const count = await workspace.fs.readFile(resultsJson).then((content) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const results: ITestSuites[] = JSON.parse(Buffer.from(content.buffer).toString())

		if (results.length === 0) {
			throw new Error('[getTestCount] no testsuite found in results')
		}

		if (status === 'tests') {
			return results[0].tests
		} else if (status === 'pass') {
			return results[0].passed
		} else if (status === 'fail') {
			return results[0].failures
		} else if (status === 'error') {
			return results[0].errors
		} else {
			throw new Error('[getTestCount] unknown status: ' + status)
		}
	})
	log.info('getTestCount: ' + status + ' = ' + count)
	return count
}

export function getDefaultDLC () {
	if (process.platform === 'linux') {
		return '/psc/dlc'
	}
	return 'C:\\Progress\\OpenEdge'
}

export async function runAllTests (doRefresh = true, waitForResults = true, withCoverage = false, tag?: string) {
	let testCommand = 'testing.runAll'
	if (withCoverage) {
		testCommand = 'testing.coverageAll'
	}
	runAllTestsDuration = new Duration('runAllTests')
	if (!tag) {
		tag = projName()
	}
	if (tag) {
		tag = '[' + tag + '] '
	} else {
		tag = ''
	}

	log.info(tag + 'running all tests')
	if (doRefresh) {
		log.info('refresh before run - start')
		await refreshTests()
		// await refreshTests()
		// 	.then(() => {
		// 		log.info('refreshTests complete!')
		// 		return true
		// 	}, (e) => { throw e })
	}

	log.info('testing.runAll starting (waitForResults=' + waitForResults + ')')
	const r = await commands.executeCommand(testCommand)
		.then(() => { return sleep(250) })
		.then(() => {
			log.info(tag + 'testing.runAll completed - start getResults()')
			if (!waitForResults) { return [] }
			return getResults(1, tag)
		})
		.then((r) => {
			if (r.length >= 0) {
				const fUri = r[0]?.cfg.ablunitConfig.optionsUri.filenameUri
				log.info(tag + 'testing.runAll command complete (filename=' + fUri + ', r=' + r + ')')
				return doesFileExist(fUri)
			}
			return false
		}, (err) => {
			runAllTestsDuration?.stop()
			log.error(tag + 'testing.runAll failed: ' + err)
			throw new Error('testing.runAll failed: ' + err)
		})
	runAllTestsDuration.stop()
	log.info(tag + 'runAllTests complete (r=' + r + ')')
	return
}

export function runAllTestsWithCoverage () {
	return runAllTests(true, true, true)
}

function waitForRefreshComplete () {
	const waitTime = 5000
	const refreshDuration = new Duration('waitForRefreshComplete')
	log.info('waiting for refresh to complete...')
	return new Promise((resolve, reject) => {
		const interval = setInterval(() => {
			if (refreshDuration.elapsed() > waitTime) {
				clearInterval(interval)
				reject(new Error('refresh took longer than ' + waitTime + 'ms'))
			}
			const p = commands.executeCommand('_ablunit.isRefreshTestsComplete')
				.then((r: unknown) => {
					if (r) {
						clearInterval(interval)
						resolve(refreshDuration.elapsed())
					}
					return r
				}, (e) => { throw e })
		}, 500)
	})

}

export function refreshTests () {
	log.info('testing.refreshTests starting...')
	return commands.executeCommand('testing.refreshTests')
		.then(() => { return waitForRefreshComplete() })
		.then((r) => {
			log.info('testing.refreshTests completed! (r=' + r + ')')
			return true
		}, (err) => {
			log.info('testing.refreshTests caught an exception. err=' + err)
			throw err
		})
}

export async function waitForTestRunStatus (waitForStatus: RunStatus) {
	const waitTime = new Duration()
	let runData: ABLResults[] = []
	let currentStatus = RunStatus.None

	log.info('waiting for test run status = \'running\'')

	setTimeout(() => { throw new Error('waitForTestRunStatus timeout') }, 20000)
	while (currentStatus < waitForStatus)
	{
		log.info('loop-1')
		await sleep2(500, 'waitForTestRunStatus currentStatus=\'' + currentStatus.toString() + '\' + , waitForStatus=\'' + waitForStatus.toString() + '\'')
		log.info('loop-2')
		runData = await getCurrentRunData()
		currentStatus = runData[0].status
		log.info('loop-4')
	}

	log.info('found test run status    = \'' + currentStatus + '\'' + waitTime.toString())
	log.info('comparing to run status  = \'' + waitForStatus + '\'')
	if ((currentStatus as number) < (waitForStatus as number)) {
		throw new Error('test run status should equal ' + waitForStatus.toString() + ' but is ' + currentStatus.toString())
	}
}

export async function cancelTestRun (resolveCurrentRunData = true) {
	cancelTestRunDuration = new Duration()
	if (resolveCurrentRunData) {
		const status = getCurrentRunData().then((resArr) => {
			if (resArr.length > 0) {
				return resArr[0].status
			}
			return 'results.length=0'
		}, () => {
			return 'not found'
		})
		log.info('cancelling test run (STATUS=' + await status + ')')
	} else {
		log.info('cancelling test run')
	}

	return commands.executeCommand('testing.cancelRun').then(() => {
		cancelTestRunDuration?.stop()
		log.info('cancelDuration=' + cancelTestRunDuration?.elapsed() + 'ms')
		return cancelTestRunDuration
	})
}

export function setConfig (key: string, value?: unknown) {
	log.info(isoDate() + ' [setConfig] key=' + key + ', ' + JSON.stringify(value))
	const section1 = key.split('.').shift()
	const section2 = key.split('.').slice(1).join('.')
	const conf = workspace.getConfiguration(section1)
	return conf.update(section2, value)
}

function getConfigDefaultValue (key: string) {
	const keys = key.split('.')
	const basekey = keys.shift()
	const childkey = keys.join('.')
	log.debug('key=' + key + ', basekey=' + basekey + ', childkey=' + childkey)
	const workspaceConfig = workspace.getConfiguration(basekey, getWorkspaceUri())
	const t = workspaceConfig.inspect(childkey)
	log.debug('inspect=' + JSON.stringify(t))
	if (t?.defaultValue) {
		return t.defaultValue
	}
	return undefined
}

export function updateConfig (key: string, value: unknown, configurationTarget?: boolean | vscode.ConfigurationTarget | null | undefined) {
	const sectionArr = key.split('.')
	const section1 = sectionArr.shift()
	const section2 = sectionArr.join('.')

	const workspaceConfig = workspace.getConfiguration(section1, getWorkspaceUri())

	const currentValue = workspaceConfig.get(section2)
	log.info('current=' + JSON.stringify(currentValue))
	log.info('  value=' + JSON.stringify(value))
	if (JSON.stringify(value) === JSON.stringify(currentValue)) {
		// log.debug(section1 + '.' + section2 + ' is already set to \'' + value + '\'')
		log.warn(key + ' is already set to \'' + value + '\'')
		return Promise.resolve(true)
	}

	if (!value) {
		const defaultValue = getConfigDefaultValue(key)
		log.info('default=' + JSON.stringify(defaultValue))
		if (JSON.stringify(defaultValue) === JSON.stringify(currentValue)) {
			log.warn(key + ' is already set to default value \'' + value + '\'')
			return Promise.resolve(true)
		}
	}
	log.info('updating configuration section1=' + section2 + ', section2=' + section2 + ', key=' + key + ' value=' + JSON.stringify(value))
	return workspaceConfig.update(section2, value, configurationTarget)
		.then(() => true, (e) => { throw e })
}

export async function updateTestProfile (key: string, value: string | string[] | boolean) {
	const testProfileUri = Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')
	if (!doesFileExist(testProfileUri)) {
		log.info('creating ablunit-test-profile.json')
		const newProfile = { configurations: [ new DefaultRunProfile ] } as IConfigurations
		await workspace.fs.writeFile(testProfileUri, Buffer.from(JSON.stringify(newProfile)))
	}
	const profile = readStrippedJsonFile(testProfileUri)
	const keys = key.split('.')

	if (keys.length === 3) {
		// @ts-expect-error ThisIsSafeForTesting
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile.configurations[0][keys[0]][keys[1]][keys[2]] = value
	} else if (keys.length ===2) {
		// @ts-expect-error ThisIsSafeForTesting
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile.configurations[0][keys[0]][keys[1]] = value
	} else {
		// @ts-expect-error ThisIsSafeForTesting
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile.configurations[0][keys[0]] = value
	}

	// profile.configurations[0][key] = value
	let newtext = JSON.stringify(profile, null, 4) + '\n'
	if (process.platform === 'win32') {
		newtext = newtext.replace(/\n/g, '\r\n')
	}
	const newjson = Buffer.from(newtext)
	return workspace.fs.writeFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json'), newjson)
}

export function selectProfile (profile: string) {
	if (! extensions.getExtension('riversidesoftware.openedge-abl-lsp')) {
		throw new Error('openedge-abl-lsp is not installed')
	}
	const profileJson = {
		profile: profile
	}
	const profileUri = Uri.joinPath(getWorkspaceUri(), '.vscode', 'profile.json')
	return workspace.fs.writeFile(profileUri, Buffer.from(JSON.stringify(profileJson))).then(() => {
		return restartLangServer()
	})
}

export function refreshData (resultsLen = 0) {
	testController = undefined
	recentResults = undefined
	currentRunData = undefined

	log.info('refreshData start')
	return commands.executeCommand('_ablunit.getExtensionTestReferences').then((resp) => {
		// log.info('refreshData command complete (resp=' + JSON.stringify(resp) + ')')
		log.info('getExtensionTestReferences command complete')
		const refs = resp as IExtensionTestReferences
		// log.info('refs=' + JSON.stringify(refs))
		const passedTests = refs.recentResults?.[0].ablResults?.resultsJson[0].testsuite?.[0].passed ?? undefined
		log.info('recentResults.length=' + refs.recentResults.length)
		log.info('recentResults[0].ablResults.=' + refs.recentResults?.[0].status)
		log.info('recentResults[0].ablResults.resultsJson.length=' + recentResults?.[0].ablResults?.resultsJson.length)
		log.info('passedTests=' + passedTests)

		if (passedTests && passedTests <= resultsLen) {
			throw new Error('failed to refresh test results: results.length=' + refs.recentResults.length)
		}
		testController = refs.testController
		recentResults = refs.recentResults
		if (refs.currentRunData) {
			currentRunData = refs.currentRunData
			return true
		}
		return false
	}, (err) => {
		log.error('failed to refresh test results: ' + err)
		throw new Error('failed to refresh test results: ' + err)
	})
}

export async function getTestController (skipRefresh = false) {
	if (!skipRefresh && !testController) {
		await refreshData()
	}
	return testController
}

export async function getTestControllerItemCount (type?: 'ABLTestFile' | undefined) {
	const ctrl = await getTestController(type == 'ABLTestFile')
	if (!ctrl?.items) {
		return 0
	}
	return ctrl.items.size + getChildTestCount(type, ctrl.items)
}

export function getChildTestCount (type: string | undefined, items: TestItemCollection) {
	if (items.size === 0) {
		return 0
	}
	let count = 0

	for (const [id, item] of items) {
		if (id.endsWith('.p') || id.endsWith('.cls')) {
			count ++
		} else {
			count += getChildTestCount(type, item.children)
		}
	}
	return count
}

export async function getCurrentRunData (len = 1, resLen = 0, tag?: string) {
	if (tag) {
		tag = '[' + tag + '] '
	} else {
		tag = ''
	}
	log.info(tag + ' start getCurrentRunData')

	await refreshData(resLen)
	if (!currentRunData || currentRunData.length === 0) {
		log.info(tag + 'getCurrentRunData not set, refreshing...')
		for (let i=0; i<3; i++) {
			await sleep2(500, tag + 'still no currentRunData, sleep before trying again (' + i + '/3)')
			const prom = refreshData(resLen).then(() => {
				log.debug('refresh success')
				return true
			}, (err) => {
				log.error('refresh failed: ' + err)
				return false
			})

			log.info(tag + 'getCurrentRunData - await prom start')
			const retResults = await prom
			log.info(tag + 'getCurrentRunData - prom.done retResults=' + retResults)
			log.info(tag + 'currentRunData.length=' + currentRunData?.length + ', retResults=' + retResults)
			if (retResults && (currentRunData?.length ?? 0) > len && (recentResults?.length ?? 0) > resLen) {
				log.info(tag + ' break')
				break
			}
		}
		log.info(tag + 'found currentRunData.length=' + currentRunData?.length)
	}

	log.info(tag + 'getCurrentRunData - currentRunData.length=' + currentRunData?.length)
	if (!currentRunData) {
		throw new Error('currentRunData is null')
	}
	if (currentRunData.length === 0) {
		throw new Error(tag + 'recent results should be > 0')
	}
	if (currentRunData.length !== len) {
		throw new Error(tag + 'recent results should be ' + len + ' but is ' + currentRunData.length)
	}
	return currentRunData
}

export async function getResults (len = 1, tag?: string): Promise<ABLResults[]> {
	if ((!recentResults || recentResults.length === 0) && len > 0) {
		log.info(tag + 'recentResults not set, refreshing...')
		for (let i=0; i<5; i++) {
			const prom = sleep2(250, tag + 'still no recentResults, sleep before trying again (' + i + '/3)')
				.then(() => { return refreshData() })
				.then((gotResults) => {
					if (gotResults) { return gotResults }
					return sleep2(250)
				})
				.catch((e: unknown) => { log.error('no recentResults yet (' + i + '/3) (e=' + e + ')') })

			if (await prom && (recentResults?.length ?? 0) > 0) {
				break
			}
		}
	}
	if (!recentResults) {
		throw new Error('recentResults is null')
	}
	if (recentResults.length < len) {
		throw new Error('recent results should be >= ' + len + ' but is ' + recentResults.length)
	}
	return recentResults
}

class AssertTestResults {
	assertResultsCountByStatus (expectedCount: number, status: 'passed' | 'failed' | 'errored' | 'all') {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const res = recentResults?.[0].ablResults?.resultsJson[0]
		if (!res) {
			assertParent.fail('No results found. Expected ' + expectedCount + ' ' + status + ' tests')
			return
		}

		switch (status) {
			// case 'passed': actualCount = res.passed; break
			case 'passed': assertParent.equal(expectedCount, res.passed, 'test count passed != ' + expectedCount); break
			// case 'failed': actualCount = res.failures; break
			case 'failed': assertParent.equal(expectedCount, res.failures, 'test count failed != ' + expectedCount); break
			// case 'errored': actualCount = res.errors; break
			case 'errored': assertParent.equal(expectedCount, res.errors, 'test count errored != ' + expectedCount); break
			// case 'all': actualCount = res.tests; break
			case 'all': assertParent.equal(expectedCount, res.tests, 'test count != ' + expectedCount); break
			default: throw new Error('unknown status: ' + status)
		}
	}

	public count = (expectedCount: number) => {
		this.assertResultsCountByStatus(expectedCount, 'all')
	}
	public passed (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'passed')
	}
	public errored (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'errored')
	}
	public failed (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'failed')
	}
}

export const assert = {

	assert: (value: unknown, message?: string) => {
		assertParent.ok(value, message)
	},
	// equal = AssertParent.equal
	equal: (actual: unknown, expected: unknown, message?: string) => {
		if (actual instanceof Uri) {
			actual = actual.fsPath
		}
		if (expected instanceof Uri) {
			expected = expected.fsPath
		}
		assertParent.equal(actual, expected, message)
	},
	notEqual: assertParent.notEqual,
	strictEqual: assertParent.strictEqual,
	notStrictEqual: assertParent.notStrictEqual,
	deepEqual: assertParent.deepEqual,
	notDeepEqual: assertParent.notDeepEqual,
	fail: assertParent.fail,
	ok: assertParent.ok,
	ifError: assertParent.ifError,
	throws: assertParent.throws,
	doesNotThrow: assertParent.doesNotThrow,

	greater (testValue: number, greaterThan: number, message?: string) {
		assertParent.ok(testValue > greaterThan, message)
	},
	greaterOrEqual (testValue: number, greaterThan: number, message?: string) {
		assertParent.ok(testValue >= greaterThan, message)
	},
	lessOrEqual (testValue: number, lessThan: number, message?: string) {
		assertParent.ok(testValue <= lessThan, message)
	},

	throwsAsync: async (block: () => Promise<void>, message?: string) => {
		try {
			const r = block()
			await r.then(() => {
				assertParent.fail('expected exception not thrown. message=\'' + message + '\'')
				return
			})
		} catch (e) {
			assertParent.ok(true)
		}
	},
	doesNotThrowAsync: async (block: () => Promise<void>, message?: string) => {
		try {
			const r = block()
			await r.then(() => {
				assertParent.ok(true)
				return
			})
			assertParent.ok(true)
		} catch (e) {
			assertParent.fail('exception thrown: ' + e + '. message=' + message)
		}
	},

	fileExists: (...files: string[] | Uri[]) => {
		if (files.length === 0) { throw new Error('no file(s) specified') }
		for (const file of files) {
			assertParent.ok(doesFileExist(file), 'file does not exist: ' + fileToString(file))
		}
	},
	notFileExists: (...files: string[] | Uri[]) => {
		if (files.length === 0) { throw new Error('no file(s) specified') }
		for (const file of files) {
			assertParent.ok(!doesFileExist(file), 'file exists: ' + fileToString(file))
		}
	},
	dirExists: (...dirs: string[] | Uri[]) => {
		if (dirs.length === 0) { throw new Error('no dir(s) specified') }
		for (const dir of dirs) {
			assertParent.ok(doesDirExist(dir), 'dir does not exist: ' + fileToString(dir))
		}
	},
	notDirExists: (...dirs: string[] | Uri[]) => {
		if (dirs.length === 0) { throw new Error('no dir(s) specified') }
		for (const dir of dirs) {
			assertParent.ok(!doesDirExist(dir), 'dir exists: ' + fileToString(dir))
		}
	},

	durationLessThan (duration: Duration | undefined, limit: number) {
		assertParent.ok(duration, 'duration is undefined')
		const name = duration.name ?? 'duration'
		assertParent.ok(duration.elapsed() < limit, name + ' is not less than limit (' + duration.elapsed() + ' / ' + limit + 'ms)')
	},
	tests: new AssertTestResults(),
}

export async function beforeProj7 () {
	await suiteSetupCommon()
	const templateProc = Uri.joinPath(toUri('src/template_proc.p'))
	const templateClass = Uri.joinPath(toUri('src/template_class.cls'))
	const classContent = await workspace.fs.readFile(templateClass).then((data) => {
		return data.toString()
	})

	for (let i = 0; i < 10; i++) {
		await workspace.fs.createDirectory(toUri('src/procs/dir' + i))
		await workspace.fs.createDirectory(toUri('src/classes/dir' + i))
		for (let j = 0; j < 10; j++) {
			await workspace.fs.copy(templateProc, toUri('src/procs/dir' + i + '/testProc' + j + '.p'), { overwrite: true })

			const writeContent = Uint8Array.from(Buffer.from(classContent.replace(/template_class/, 'classes.dir' + i + '.testClass' + j)))
			await workspace.fs.writeFile(toUri('src/classes/dir' + i + '/testClass' + j + '.cls'), writeContent)
		}
	}
	return sleep(250)
}

log.info('testCommon.ts loaded!')
