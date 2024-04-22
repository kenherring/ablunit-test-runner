import * as assertParent from 'assert'
import * as fs from 'fs'
import { globSync } from 'glob'
import * as vscode from 'vscode'
import {
	CancellationError, ConfigurationTarget, TestController,
	TestItemCollection,
	Uri,
	Selection,
	WorkspaceFolder, commands, extensions, window,
	workspace
} from 'vscode'
import { ABLResults } from '../src/ABLResults'
import { Duration, deleteFile as deleteFileCommon, isRelativePath, readStrippedJsonFile } from '../src/ABLUnitCommon'
import { log as logObj } from '../src/ChannelLogger'
import { Decorator } from '../src/Decorator'
import { IExtensionTestReferences } from '../src/extension'
import { ITestSuites } from '../src/parse/ResultsParser'
import { IConfigurations, parseRunProfiles } from '../src/parse/TestProfileParser'
import { DefaultRunProfile, IRunProfile as IRunProfileGlobal } from '../src/parse/config/RunProfile'
import { RunStatus } from '../src/ABLUnitRun'
import path from 'path'
import { rebuildAblProject, waitForLangServerReady } from './openedgeAblCommands'

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
		return oeVersionEnv
	}

	const oeVersion = getEnvVar('OE_VERSION')
	log.info('oeVersion=' + oeVersion + ' ' + oeVersion?.split('.').slice(0, 2).join('.'))
	if (oeVersion?.match(/^(11|12)\.\d.\d+$/)) {
		return oeVersion.split('.').slice(0, 2).join('.')
	}

	const versionFile = path.join(getDefaultDLC(), 'version')
	const dlcVersion = fs.readFileSync(versionFile)
	log.info('dlcVersion=' + dlcVersion)
	if (dlcVersion) {
		const match = dlcVersion.toString().match(/OpenEdge Release (\d+\.\d+)/)
		if (match) {
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


// test objects
export const log = logObj
export class FilesExclude {
	exclude: Record<string, boolean> = {}
}
// riversidesoftware.openedge-abl-lsp extension objects
export { rebuildAblProject }
// kherring.ablunit-test-runner extension objects
export type IRunProfile = IRunProfileGlobal
export { RunStatus, parseRunProfiles }
// vscode objects
export {
	CancellationError, Duration, Selection, Uri,
	commands, extensions, window, workspace
}

const projName = () => { return getWorkspaceUri().fsPath.replace(/\\/g, '/').split('/').pop() }
let recentResults: ABLResults[] | undefined
let decorator: Decorator | undefined
let testController: TestController | undefined
let currentRunData: ABLResults[] | undefined

log.info('[testCommon.ts] enableExtensions=' + enableExtensions() + ', projName=' + projName())

export async function newTruePromise () {
	return new Promise(resolve => { resolve(true) })
}

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

export async function suiteSetupCommon () {
	log.info('waitForExtensionActive \'kherring.ablunit-test-runner\' (projName=' + projName() + ')')
	await waitForExtensionActive()
	const extname = 'riversidesoftware.openedge-abl-lsp'

	if (enableExtensions()) {
		await installExtension(extname).then((r) => {
			if (!r) {
				throw new Error('failed to install extension ' + extname)
			}
			log.info('installed extension ' + extname)
			log.debug('installed extension ' + extname + ' (r=' + JSON.stringify(r) + ')')
			return
		}, (e) => {
			log.error('failed to install extension ' + extname + ' (e=' + e + ')')
			throw e
		})
		log.info('suiteSetupCommon-3 activateExtension ' + extname)
		await activateExtension(extname).then((r) => {
			log.info('activated extension ' + extname + ' (isActive=' + r + ')')
			return r
		}, (e) => {
			log.error('failed to activate extension ' + extname + ' (e=' + e + ')')
			throw e
		})
		log.debug('setRuntimes')
		const r = await setRuntimes().then((r: number) => r, (e) => {
			log.error('failed to set runtimes (e=' + e + ')')
			throw e
		})
		log.debug('runtimes set (r=' + r + ')')
	}
	log.info('suiteSetupCommon complete!')
}

export let runAllTestsDuration: Duration | undefined
export let cancelTestRunDuration: Duration | undefined

export function teardownCommon () {
	runAllTestsDuration = undefined
	cancelTestRunDuration = undefined

	decorator = undefined
	testController = undefined
	recentResults = undefined
	currentRunData = undefined
}

export async function suiteTeardownCommon () {
	await setRuntimes()
}

export async function setFilesExcludePattern () {
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

export async function installExtension (extname = 'riversidesoftware.openedge-abl-lsp') {
	log.info('[installExtension] start process.args=' + process.argv.join(' '))
	const ext = extensions.getExtension(extname)
	if (ext) {
		log.info('[installExtension] extension ' + extname + ' is already installed')
		return ext
	}
	// if (extname === 'riversidesoftware.openedge-abl-lsp' && enableExtensions()) {
	// 	// throw new Error('extensions disabed, openedge-abl-lsp cannot be installed')
	// 	log.warn('extensions disabed, openedge-abl-lsp cannot be installed')
	// 	return
	// }


	log.info('[installExtension] installing ' + extname + ' extension...')
	const installCommand = 'workbench.extensions.installExtension'

	return commands.executeCommand(installCommand, extname).then(async r => {
		log.info('post-' + installCommand + '(r=' + r + ')')
		return sleep2(250).then(() => {
			log.info('get extension \'' + extname + '\'...')
			const ext = extensions.getExtension(extname)
			if (!ext) { throw new Error('get after install failed') }
			return ext
		})
	}, (e) => {
		log.error(installCommand + ' failed to install extension \'' + extname + '\'!')
		throw e
	})
}

export function setupCommon () {
	recentResults = undefined
	decorator = undefined
	testController = undefined
	currentRunData = undefined
}

export function deleteFile (file: Uri | string) {
	if (typeof file === 'string') {
		file = Uri.joinPath(getWorkspaceUri(), file)
	}
	deleteFileCommon(file)
}

export async function sleep2 (time = 10, msg?: string | null) {
	if (msg !== null) {
		let status = 'sleeping for ' + time + 'ms'
		if (msg) {
			status = status + ' [' + msg + ']'
		}
		log.info(status)
	}
	return new Promise(resolve => setTimeout(resolve, time))
}

export async function sleep (requestedTime = 25, msg?: string) {
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
	log.info('[activateExtension] activating ' + extname + ' extension...')
	let ext = extensions.getExtension(extname)
	if (!ext) {
		await sleep2(250, 'wait and retry getExtension')
		ext = extensions.getExtension(extname)
	}
	if (!ext) {
		throw new Error('cannot activate extension, not installed: ' + extname)
	}
	log.info('[activateExtension] active? ' + ext.isActive)

	if (!ext.isActive) {
		log.info('[activateExtension] activate')
		await ext.activate()
	}
	if (extname === 'riversidesoftware.openedge-abl-lsp') {
		await waitForLangServerReady()
	}
	log.info('[activateExtension] activated ' + extname + ' extension!')
	return ext.isActive
}

async function waitForExtensionActive (extensionId = 'kherring.ablunit-test-runner') {
	let ext = extensions.getExtension(extensionId)
	if (!ext) {
		await sleep2(250, 'wait and retry getExtension')
		ext = extensions.getExtension(extensionId)
	}
	if (!ext) {
		throw new Error(extensionId + ' is not installed')
	}

	if (!ext.isActive) {
		await ext.activate().then(() => {
			log.info('activated ' + extensionId)
		}, (err) => {
			throw new Error('failed to activate kherring.ablunit-test-runner: ' + err)
		})
	}

	if(!ext.isActive) {
		log.info('waiting for extension to activate - should never be here!')
		for (let i=0; i<50; i++) {
			if (ext.isActive) {
				log.info('waitied ' + (i + 1) * 100 + 'ms for extension to activate')
				break
			}
		}
	}

	if (!ext.isActive) {
		throw new Error(extensionId + ' is not active')
	}
	log.info(extensionId + ' is active!')
	// return refreshData()
}

function getRcodeCount (workspaceFolder?: WorkspaceFolder) {
	if (!workspaceFolder) {
		workspaceFolder = workspace.workspaceFolders?.[0]
	}
	if (!workspaceFolder) {
		throw new Error('workspaceFolder is undefined')
	}
	const g = globSync('**/*.r', { cwd: workspaceFolder?.uri.fsPath })
	const fileCount = g.length
	if (fileCount >= 0) {
		log.info('found ' + fileCount + ' r-code files')
		return fileCount
	}
	log.error('fileCount is not a number! fileCount=' + fileCount)
	return -1
}

// TODO - duplicated in openedgeAblCommands.ts
export async function setRuntimes (runtimes: IRuntime[] = [{name: '12.2', path: getDefaultDLC(), default: true}]): Promise<number> {
	if (!enableExtensions()) {
		throw new Error('extensions are disabled, failed to set runtimes!')
	}
	log.info('setting abl.configuration.runtimes=' + JSON.stringify(runtimes))
	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	if (!ext) {
		throw new Error('extension not installed: riversidesoftware.openedge-abl-lsp')
	}
	if (!ext.isActive) {
		throw new Error('extension not active: riversidesoftware.openedge-abl-lsp')
	}

	const conf = workspace.getConfiguration('abl')
	const current = conf.get('configuration.runtimes') as IRuntime[]
	log.debug('current=' + JSON.stringify(current))
	log.debug('  input=' + JSON.stringify(runtimes))
	if (JSON.stringify(current) === JSON.stringify(runtimes)) {
		log.warn('runtmes are already set')
		return getRcodeCount()
	}

	log.debug('    conf=' + JSON.stringify(conf))
	log.debug('runtimes=' + JSON.stringify(runtimes))

	const prom = conf.update('configuration.runtimes', runtimes, ConfigurationTarget.Global).then(async () => {
	// const prom = conf.update('configuration.runtimes', runtimes, ConfigurationTarget.Global).then(() => {
		return rebuildAblProject().then((r) => {
			log.info('abl.configuration.runtimes set successfully (r=' + r + ')')
			return r
		}, (e) => { throw e })
	}, (e) => {
		log.error('unexpected error updating abl.configuration.runtimes! e=' + e)
		throw e
	})

	if (! (prom instanceof Promise)) {
		const num = await prom
		return new Promise(resolve => { resolve(num) })
	}
	return prom as Promise<number>

}

export async function awaitRCode (workspaceFolder: WorkspaceFolder, rcodeCountMinimum = 1) {
	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	log.info('[awaitRCode] isActive=' + ext?.isActive)
	if (!ext?.isActive) {
		log.info('[awaitRCode] extension active! (ext=' + JSON.stringify(ext) + ')')
		throw new Error('openedge-abl-lsp is not active! rcode cannot be created')
	}
	const buildWaitTime = 20

	for (let i = 0; i < 10; i++) {
		const prom = commands.executeCommand('abl.project.rebuild').then(() => true, (err) => {
			log.error('[awaitRCode] abl.project.rebuild failed! err=' + err)
			return false
		})
		if (await prom) {
			log.info('Language client is ready!')
			break
		}
		await sleep2(500)
	}

	log.info('waiting up to ' + buildWaitTime + ' seconds for r-code')
	for (let i = 0; i < buildWaitTime; i++) {
		const rcodeCount = getRcodeCount(workspaceFolder)
		if (rcodeCount >= rcodeCountMinimum) {
			log.info('compile complete! rcode count = ' + rcodeCount)
			return rcodeCount
		}
		log.info('found ' + rcodeCount + ' r-code files. waiting... (' + i + '/' + buildWaitTime + ')')
		await sleep2(500)
	}

	await commands.executeCommand('abl.dumpFileStatus').then(() => { log.info('abl.dumpFileStatus complete!') })
	await commands.executeCommand('abl.dumpLangServStatus').then(() => { log.info('abl.dumpLangServStatus complete!') })
	throw new Error('r-code files not found')
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
	} else if(process.platform === 'linux') {
		return Uri.file('/tmp/ablunit')
	} else {
		throw new Error('Unsupported platform: ' + process.platform)
	}
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

export async function runAllTests (doRefresh = true, waitForResults = true, tag?: string) {
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
		await refreshTests().then(async () => { return sleep2(500, tag + 'after refreshTests') })
	} else {
		await sleep(250, tag + 'sleep before testing.runAll')
	}

	log.info('testing.runAll starting (waitForResults=' + waitForResults + ')')
	const r = await commands.executeCommand('testing.runAll').then(async () => {
		log.info(tag + 'testing.runAll completed - start getResults()')
		if (!waitForResults) { return false }

		return getResults(1, tag).then((r) => {
			const fUri = r?.[0]?.cfg.ablunitConfig.optionsUri.filenameUri
			log.info(tag + 'testing.runAll found results file (filename=' + fUri + ', r=' + r + ')')

			if (doesFileExist(fUri)) { return true }
			throw new Error('no results file found (filename=' + fUri + ')')
		})
	}, (err) => {
		runAllTestsDuration?.stop()
		log.error(tag + 'testing.runAll failed: ' + err)
		throw new Error('testing.runAll failed: ' + err)
	})
	runAllTestsDuration?.stop()
	log.info(tag + 'runAllTests complete (r=' + r + ')')
}

export function refreshTests () {
	return commands.executeCommand('testing.refreshTests').then(() => {
		log.info('testing.refreshTests completed!')
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
		await sleep2(500, 'waitForTestRunStatus currentStatus=\'' + currentStatus.toString() + '\' + , waitForStatus=\'' + waitForStatus.toString() + '\'')
		runData = await getCurrentRunData()
		currentStatus = runData[0].status
	}

	log.info('found test run status = \'' + currentStatus + '\'' + waitTime.toString())
	if (currentStatus === waitForStatus) {
		throw new Error('test run status should equal with ' + waitForStatus.toString() + ' but is ' + currentStatus.toString())
	}
}

export async function cancelTestRun (resolveCurrentRunData = true) {
	cancelTestRunDuration = new Duration()
	if (resolveCurrentRunData) {
		const status = getCurrentRunData().then((resArr) => {
			if (resArr && resArr.length > 0) {
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


export async function updateConfig (key: string, value: string | string[] | undefined | null): Promise<void> {
	const keys = key.split('.')
	const section1 = keys.shift()
	const section2 = keys.join('.')

	if (value === undefined) {
		// value = null
		value = []
	}

	const duration = new Duration('updateConfig')
	log.info('setting ' + key + '=' + JSON.stringify(value))
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	if (!ext) {
		throw new Error('extension not installed: khering.ablunit-test-runner')
	}
	if (!ext.isActive) {
		throw new Error('extension not active: kherring.ablunit-test-runner')
	}

	log.info('section1=' + section1 + ', section2=' + section2)
	const confNull = workspace.getConfiguration(section1, null)
	log.info('confNull=' + JSON.stringify(confNull, null, 4))
	const confUndefined = workspace.getConfiguration(section1, null)
	log.info('confUndefined=' + JSON.stringify(confUndefined, null, 4))
	const conf = workspace.getConfiguration(section1, getWorkspaceFolders()[0])
	log.info('conf=' + JSON.stringify(conf, null, 4))

	const current = conf.get(section2)
	log.info('current ' + key + '=' + JSON.stringify(current))
	log.info('setting ' + key + '=' + JSON.stringify(value))
	// log.info('current=' + JSON.stringify(current))
	// log.info('  input=' + JSON.stringify(runtimes))
	if (JSON.stringify(current) === JSON.stringify(value)) {
		log.info(key + ' is already set to ' + JSON.stringify(value))
		return Promise.resolve()
	}

	log.info('await conf.update')
	await conf.update(section2, value, false).then(() => {
		const confUpdated = workspace.getConfiguration(section1)
		log.info('new ' + key + '=' + JSON.stringify(confUpdated.get(section2)))
		return
		// log.info('old ' + key + '=' + JSON.stringify(conf.get(section2)))
	}, (e: unknown) => {
		if (e instanceof Error) { throw e }
		throw new Error('update config ' + key + ' failed! e=' + e)
	})
	log.info('conf.update complete')
	return Promise.resolve()
	// log.info ('waiting on prom')
	// return prom.then(() => {
	// 	log.info('update "' + key + '" complete! ' + duration.toString())
	// })
	// log.info('updateConfig complete!')
	// return Promise.resolve()
}

export async function updateConfigProm (key: string, value: string | string[] | undefined | null): Promise<void> {
	const keys = key.split('.')
	const section1 = keys.shift()
	const section2 = keys.join('.')

	if (value === undefined) {
		// value = null
		value = []
	}

	return new Promise((resolve, reject) => {
		const duration = new Duration('updateConfig')
		log.info('setting ' + key + '=' + JSON.stringify(value))
		const ext = extensions.getExtension('kherring.ablunit-test-runner')
		if (!ext) {
			throw new Error('[setRuntimes] extension not installed: khering.ablunit-test-runner')
		}
		if (!ext.isActive) {
			throw new Error('[setRuntimes] extension not active: kherring.ablunit-test-runner')
		}

		log.info('section1=' + section1 + ', section2=' + section2)
		const confNull = workspace.getConfiguration(section1, null)
		log.info('confNull=' + JSON.stringify(confNull, null, 4))
		const confUndefined = workspace.getConfiguration(section1, null)
		log.info('confUndefined=' + JSON.stringify(confUndefined, null, 4))
		const conf = workspace.getConfiguration(section1, getWorkspaceFolders()[0])
		log.info('conf=' + JSON.stringify(conf, null, 4))

		const current = conf.get(section2)
		log.info('current ' + key + '=' + JSON.stringify(current))
		log.info('setting ' + key + '=' + JSON.stringify(value))
		// log.info('current=' + JSON.stringify(current))
		// log.info('  input=' + JSON.stringify(runtimes))
		if (JSON.stringify(current) === JSON.stringify(value)) {
			log.info(key + ' is already set to ' + JSON.stringify(value))
			resolve()
			return
		}

		conf.update(section2, value, false).then(() => {
			const confUpdated = workspace.getConfiguration(section1)
			log.info('old ' + key + '=' + JSON.stringify(conf.get(section2)))
			log.info('new ' + key + '=' + JSON.stringify(confUpdated.get(section2)))
		}, (e: unknown) => {
			if (e instanceof Error) {
				reject(e)
				return
			}
			reject(new Error('update config ' + key + ' failed! e=' + e))
			return
		})
	})
	log.info(isoDate() + ' success!')

	// {
	// 	// log.info(isoDate() + ' prom=' + JSON.stringify(prom))
	// 	// // const prom = workspaceConfig.update(section2, value)

	// 	// log.info(isoDate() + ' updateConfig-5.1.5 await')
	// 	// const r = await prom.then((ret) => {
	// 	// 	log.info(isoDate() + ' prom returned (ret=' + ret + ')')
	// 	// 	return true
	// 	// }, (err) => {
	// 	// 	log.error('unset failed! key=' + key + ', err=' + err)
	// 	// 	throw err
	// 	// })
	// 	// log.info(isoDate() + ' updateConfig-5.1.4 r=' + r)
	// 	return
	// }

	// log.info(isoDate() + ' updateConfig-6        value=' + JSON.stringify(value))
	// const r = await workspaceConfig.update(section2, value).then(() => {
	// 	log.info(isoDate() + ' updateConfig-7')
	// 	return true
	// }, (err) => {
	// 	log.error('config update \'' + section1 + '.' + section2 + '\' failed with err=' + err)
	// 	throw err
	// })
	// log.info(isoDate() + ' updateConfig-8 r=' + r)
}

// function getConfigDefaultValue (key: string) {
// 	const basekey = key.split('.').shift()
// 	log.info('key=' + key)
// 	const workspaceConfig = workspace.getConfiguration(basekey, getWorkspaceUri())
// 	const t = workspaceConfig.inspect(key)
// 	if (t?.defaultValue) {
// 		return t?.defaultValue
// 	}
// 	return undefined
// }

// export async function updateConfig (key: string, value: unknown) {
// 	return new Promise<void>((resolve, reject) => {
// 		log.info('updateConfigProm start')
// 		updateConfigProm(key, value).then(() => {
// 			log.info('updateConfigProm resolved!')
// 			resolve()
// 		}, (e: Error) => {
// 			reject(e)
// 		})
// 		log.info('updateConfigProm created')
// 	})
// }

// export async function updateConfigProm (key: string, value: unknown) {
// 	const sectionArr = key.split('.')
// 	const section1 = sectionArr.shift()
// 	const section2 = sectionArr.join('.')

// 	const workspaceConfig = workspace.getConfiguration(section1, getWorkspaceUri())

// 	const currentValue = workspaceConfig.get(section2)
// 	if (JSON.stringify(value) === JSON.stringify(currentValue)) {
// 		// log.debug(section1 + '.' + section2 + ' is already set to \'' + value + '\'')
// 		log.warn(key + ' is already set to \'' + value + '\'')
// 		return
// 	}

// 	if (!value) {
// 		const defaultValue = getConfigDefaultValue(key)
// 		if (JSON.stringify(defaultValue) === JSON.stringify(currentValue)) {
// 			log.warn(key + ' is already set to default value \'' + value + '\'')
// 			return
// 		}
// 	}
// 	return workspaceConfig.update(section2, value, null).then(() => {
// 		log.info(isoDate() + ' success!')

// 	})
// }

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
		profile['configurations'][0][keys[0]][keys[1]][keys[2]] = value
	} else if (keys.length ===2) {
		// @ts-expect-error ThisIsSafeForTesting
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile['configurations'][0][keys[0]][keys[1]] = value
	} else {
		// @ts-expect-error ThisIsSafeForTesting
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile['configurations'][0][keys[0]] = value
	}

	// profile.configurations[0][key] = value
	let newtext = JSON.stringify(profile, null, 4) + '\n'
	if (process.platform === 'win32') {
		newtext = newtext.replace(/\n/g, '\r\n')
	}
	const newjson = Buffer.from(newtext)
	return workspace.fs.writeFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json'), newjson)
}

export async function selectProfile (profile: string) {
	const profileJson = {
		profile: profile
	}
	const profileUri = Uri.joinPath(getWorkspaceUri(), '.vscode', 'profile.json')
	return workspace.fs.writeFile(profileUri, Buffer.from(JSON.stringify(profileJson))).then(async () => {
		await sleep(100)
		return commands.executeCommand('abl.restart.langserv').then(async () => {
			return sleep(500)
		}, (err) => {
			throw new Error('failed to restart langserv: ' + err)
		})
	})
}

export async function refreshData (resultsLen = 0) {
	decorator = undefined
	testController = undefined
	recentResults = undefined
	currentRunData = undefined
	log.info('ABLUNIT_TEST_RUNNER_UNIT_TESTING=' + process.env['ABLUNIT_TEST_RUNNER_UNIT_TESTING'])
	return commands.executeCommand('_ablunit.getExtensionTestReferences').then((resp) => {
		const refs = resp as IExtensionTestReferences
		let passedTests = undefined

		if (refs.recentResults[0]?.ablResults?.resultsJson?.[0].testsuite !== undefined) {
			passedTests = refs.recentResults[0].ablResults?.resultsJson[0].testsuite?.[0].passed ?? undefined
		}
		log.debug('passedTests=' + passedTests)
		if (passedTests && passedTests <= resultsLen) {
			throw new Error('failed to refresh test results: results.length=' + refs.recentResults.length)
		}
		decorator = refs.decorator
		testController = refs.testController
		recentResults = refs.recentResults
		if (refs.currentRunData) {
			currentRunData = refs.currentRunData
		}
	}, (err) => {
		// log.info(isoDate() + ' refreshData-4 err=' + err)
		throw new Error('failed to refresh test results: ' + err)
	})
}

export function getDecorator () {
	if (!decorator) {
		throw new Error('decorator is null')
	}
	return decorator
}

export async function getTestController () {
	if (!testController) {
		await refreshData()
	}
	return testController
}

export async function getTestControllerItemCount (type?: 'ABLTestFile' | undefined) {
	const ctrl = await getTestController()
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
		for (let i=0; i<15; i++) {
			const prom = sleep2(100, tag + 'still no currentRunData, sleep before trying again (' + i + '/15)').then(async () => {
				return refreshData(resLen).then(() => {
					log.debug('refresh success')
				}, (err) => {
					log.error('refresh failed: ' + err)
				})
			})
			log.info(tag + 'currentRunData.length=' + currentRunData?.length)
			if ((currentRunData?.length ?? 0) > 0) {
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

export async function getResults (len = 1, tag?: string) {
	const duration = new Duration()
	if ((!recentResults || recentResults.length === 0) && len > 0) {
		log.info(tag + 'recentResults not set, refreshing...')
		for (let i=0; i<15; i++) {
			await sleep2(500, tag + 'still no recentResults, sleep before trying again').then(async () => {
				return refreshData().then(async () => {
					return sleep2(100, null)
				})
			})
			if ((recentResults?.length ?? 0) > len) {
				log.info('found test results ' + duration)
				continue
			}
		}
	}
	if (!recentResults) {
		log.error(tag + 'recentResults is null')
		throw new Error('recentResults is null')
	}
	if (recentResults.length < len) {
		log.error(tag + 'recent results should be >= ' + len + ' but is ' + recentResults.length)
		throw new Error('recent results should be >= ' + len + ' but is ' + recentResults.length)
	}
	return recentResults
}

class AssertTestResults {
	async assertResultsCountByStatus (expectedCount: number, status: 'passed' | 'failed' | 'errored' | 'all') {
		const recentResults = await getResults()
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const res = recentResults[0].ablResults?.resultsJson[0]
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
		this.assertResultsCountByStatus(expectedCount, 'all').catch((err: unknown) => { throw err })
	}
	public passed (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'passed').catch((err: unknown) => { throw err })
	}
	public errored (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'errored').catch((err: unknown) => { throw err })
	}
	public failed (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'failed').catch((err: unknown) => { throw err })
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

	greaterOrEqual (a: number, b: number, message?: string) {
		assertParent.ok(a >= b, message)
	},
	lessOrEqual (a: number, b: number, message?: string) {
		assertParent.ok(a <= b, message)
	},

	throwsAsync: async (block: () => Promise<void>, message?: string) => {
		try {
			const r = block()
			await r.then(() => {
				assertParent.fail('expected exception not thrown. message=\'' + message + '\'')
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
