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
import { IConfigurations } from '../src/parse/TestProfileParser'
import { DefaultRunProfile } from '../src/parse/config/RunProfile'
import { RunStatus } from '../src/ABLUnitRun'

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
export const enableExtensions = process.env['ABLUNIT_TEST_RUNNER_ENABLE_EXTENSIONS'] === 'true'
// test objects
export const log = logObj
export class FilesExclude {
	exclude: {
		[key: string]: boolean
	} = {}
}
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

log.info('[testCommon.ts] enableExtensions=' + enableExtensions + ', projName=' + projName())

export async function newTruePromise () {
	return new Promise(resolve => { resolve(true) })
}

export function isoDate () {
	return '[' + new Date().toISOString() + ']'
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
	log.info('suiteSetupCommon-1 waitForExtensionActive - ablunit-test-runner (projName=' + projName() + ')')
	await waitForExtensionActive()
	const extname = 'riversidesoftware.openedge-abl-lsp'
	log.info('suiteSetupCommon-2.1 workspaceUri=' + getWorkspaceUri())
	log.info('suiteSetupCommon-2.2 workspaceUri=' + getWorkspaceUri().fsPath)
	log.info('suiteSetupCommon-2.3 workspaceUri=' + getWorkspaceUri().fsPath.replace(/\\/g, '/'))
	log.info('suiteSetupCommon-2.4 workspaceUri=' + getWorkspaceUri().fsPath.replace(/\\/g, '/').split('/'))
	log.info('suiteSetupCommon-2.5 workspaceUri=' + getWorkspaceUri().fsPath.replace(/\\/g, '/').split('/').pop())

	log.info('suiteSetupCommon-2.6 projName=' + projName)
	log.info('suiteSetupCommon-2.7 projName=' + projName())
	log.info('suiteSetupCommon-2.8 enableExtensions=' + enableExtensions)

	if (enableExtensions) {
		await installExtension(extname).then((r) => {
			if (!r) {
				throw new Error('failed to install extension ' + extname)
			}
			log.info('suiteSetupCommon-3 installed extension ' + extname + ' (r=' + JSON.stringify(r) + ')')
			return
		}, (e) => {
			log.error('failed to install extension ' + extname + ' (e=' + e + ')')
			throw e
		})
		log.info('suiteSetupCommon-3 activateExtension ' + extname)
		await activateExtension(extname).then((r) => {
			log.info('suiteSetupCommon-4 activated extension ' + extname)
			log.info('suiteSetupCommon-4 activated extension ' + extname + ' (isActive=' + r + ')')
			return r
		}, (e) => {
			log.error('failed to activate extension ' + extname + ' (e=' + e + ')')
			throw e
		})
		log.info('suiteSetupCommon-4 setRuntimes')
		const r = await setRuntimes().then((r: number) => r, (e) => {
			log.error('failed to set runtimes (e=' + e + ')')
			throw e
		})
		log.info('suiteSetupCommon-5 runtimes set (r=' + r + ')')
	}
	log.info('suiteSetupCommon complete!')
}

export let runAllTestsDuration: Duration | undefined
export let cancelTestRunDuration: Duration | undefined

export function teardownCommon () {
	runAllTestsDuration = undefined
	cancelTestRunDuration = undefined
}

export async function suiteTeardownCommon () {
	await setRuntimes()
}

export async function setFilesExcludePattern () {
	log.info('[updateFilesExcludePatterns] start')
	const files = new FilesExclude
	log.info('[updateFilesExcludePatterns] u-1')
	// files.exclude = workspace.getConfiguration('files', getWorkspaceUri()).get('exclude', {})
	const filesConfig = workspace.getConfiguration('files', getWorkspaceUri())
	files.exclude = filesConfig.get('exclude', {}) ?? {}
	log.info('[updateFilesExcludePatterns] u-2 files.exclude=' + JSON.stringify(files.exclude))
	files.exclude['**/.builder'] = true
	log.info('[updateFilesExcludePatterns] u-3')
	files.exclude['**/lbia*'] = true
	log.info('[updateFilesExcludePatterns] u-4')
	files.exclude['**/rcda*'] = true
	log.info('[updateFilesExcludePatterns] u-5')
	files.exclude['**/srta*'] = true
	log.info('[updateFilesExcludePatterns] updating... files.exclude patterns')
	log.info('[updateFilesExcludePatterns] u-7.1         filesConfig=' + JSON.stringify(filesConfig))
	log.info('[updateFilesExcludePatterns] u-7.2 filesConfig.exclude=' + JSON.stringify(filesConfig['exclude']))
	log.info('[updateFilesExcludePatterns] u-7.3       files.exclude=' + JSON.stringify(files.exclude))
	if (JSON.stringify(filesConfig['exclude']) === JSON.stringify(files.exclude)) {
		log.info('files.exclude already set to ' + JSON.stringify(files.exclude))
		return newTruePromise()
	}

	return filesConfig.update('exclude', files.exclude).then(() => {
		log.info('[updateFilesExcludePatterns] filesConfig.update success!')
		return true
	}, (err) => {
		log.error('[updateFilesExcludePatterns] filesConfig.update failed! err=' + err)
		throw err
	})
	// log.info('[updateFilesExcludePatterns] u-8 r=' + r)
	// log.info('[updateFilesExcludePatterns] complete')
}

export async function installExtension (extname = 'riversidesoftware.openedge-abl-lsp') {
	log.info('[installExtension] start process.args=' + process.argv.join(' '))
	if (extensions.getExtension(extname)) {
		log.info('[installExtension] extension ' + extname + ' is already installed')
		return true
	}

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

export async function activateExtension (extname = 'riversidesoftware.openedge-abl-lsp') {
	log.info('[activateExtension] activating ' + extname + ' extension...')
	const ext = extensions.getExtension(extname)
	if (!ext) {
		throw new Error('cannot activate extension, not installed: ' + extname)
	}
	log.info('[activateExtension] active? ' + ext.isActive)
	if (!ext.isActive) {
		log.info('[activateExtension] activate')
		await ext.activate()
	}
	log.info('[activateExtension] activated ' + extname + ' extension!')
	return ext.isActive
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

export async function sleep (requestedTime: number, msg?: string) {
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

export function getAblunitExt () {
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	if (!ext) {
		throw new Error('kherring.ablunit-test-runner is not installed')
	}
	return ext
}

export async function waitForExtensionActive (extensionId = 'kherring.ablunit-test-runner') {
	const ext = extensions.getExtension(extensionId)
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

function rebuildAblProject () {
	log.info('[rebuildAblProject] rebuilding abl project...')
	return commands.executeCommand('abl.project.rebuild').then((r) => {
		log.info('[rebuildABlProject] r=' + JSON.stringify(r))
		const rcodeCount = getRcodeCount()
		log.info('[rebuildAblProject] abl.project.rebuild command complete! (rcodeCount=' + rcodeCount + ')')
		return rcodeCount
	}, (err) => {
		log.error('[rebuildAblProject] abl.project.rebuild failed! err=' + err)
		throw err
	})
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

export async function setRuntimes (runtimes: IRuntime[] = [{name: '12.2', path: getDefaultDLC(), default: true}]): Promise<number> {
	if (!enableExtensions) {
		throw new Error('setRuntimes failed! extensions are disabled')
	}
	log.info('[setRuntimes] setting abl.configuration.runtimes=' + JSON.stringify(runtimes))
	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	log.info('201')
	if (!ext) {
		throw new Error('[setRuntimes] extension not installed: riversidesoftware.openedge-abl-lsp')
	}
	if (!ext.isActive) {
		throw new Error('[setRuntimes] extension not active: riversidesoftware.openedge-abl-lsp')
	}

	const conf = workspace.getConfiguration('abl')
	const current = conf.get('configuration.runtimes') as IRuntime[]
	log.info('current=' + JSON.stringify(current))
	log.info('  input=' + JSON.stringify(runtimes))
	if (JSON.stringify(current) === JSON.stringify(runtimes)) {
		log.info('[setRuntimes] runtmes are already set')
		return getRcodeCount()
	}

	log.info('202.2     conf=' + JSON.stringify(conf))
	log.info('202.3 runtimes=' + JSON.stringify(runtimes))

	const prom = conf.update('configuration.runtimes', runtimes, ConfigurationTarget.Global).then(() => {
	// const prom = conf.update('configuration.runtimes', runtimes, ConfigurationTarget.Global).then(() => {
		log.info('202.4')
		return rebuildAblProject().then((r) => {
			log.info('202.5 r=' + r)
			log.info('[setRuntimes] abl.configuration.runtimes set successfully')
			return r
		}, (e) => { throw e})
		// log.info('202.6 p=' + JSON.stringify(p))
		// return p
	}, (e) => {
		log.error('203 error!')
		throw e
	})
	// log.info('204')
	log.info('205 prom=' + JSON.stringify(prom))
	log.info('206 ' + typeof prom)
	if (! (prom instanceof Promise)) {
		log.info('207 NOT Promise')
		const num = await prom
		log.info('208 prom=' + JSON.stringify(num))
		return new Promise(resolve => { resolve(num) })
	}
	log.info('209 is Promise! prom=' + JSON.stringify(prom))
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
		await sleep2(1000)
	}

	log.info('waiting up to ' + buildWaitTime + ' seconds for r-code')
	for (let i = 0; i < buildWaitTime; i++) {
		const rcodeCount = getRcodeCount(workspaceFolder)
		if (rcodeCount >= rcodeCountMinimum) {
			log.info('compile complete! rcode count = ' + rcodeCount)
			return rcodeCount
		}
		log.info('found ' + rcodeCount + ' r-code files. waiting... (' + i + '/' + buildWaitTime + ')')
		await sleep2(1000)
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
		await sleep2(1000, 'waitForTestRunStatus currentStatus=\'' + currentStatus.toString() + '\' + , waitForStatus=\'' + waitForStatus.toString() + '\'')
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

export async function updateConfig (key: string, value?: unknown) {
	log.info(isoDate() + ' updateConfig-1.0 key=' + key + ', value=' + value)
	const sectionArr = key.split('.')
	log.info(isoDate() + ' updateConfig-1.1 sectionArr.length=' + sectionArr.length)
	const section1 = sectionArr.shift()
	log.info(isoDate() + ' updateConfig.1.2 section1=' + section1)
	const section2 = sectionArr.join('.')
	log.info(isoDate() + ' updateConfig-1.4 section1=' + section1 + ', section2=' + section2)

	const workspaceConfig = workspace.getConfiguration(section1, getWorkspaceUri())
	log.info(isoDate() + ' updateConfig-2.0 workspaceConfig = ' + JSON.stringify(workspaceConfig))

	log.info('get currentValue')
	const currentValue = workspaceConfig.get(section2)
	log.info(isoDate() + ' updateConfig-2.1 ' + section1 + '.' + section2 + '=' + value + ', currentValue=' + currentValue)
	if (JSON.stringify(value) === JSON.stringify(currentValue)) {
		// log.debug(section1 + '.' + section2 + ' is already set to \'' + value + '\'')
		log.info(section1 + '.' + section2 + ' is already set to \'' + value + '\'')
		log.info(key + ' is already set to \'' + value + '\'')
		return newTruePromise()
	}

	log.info(isoDate() + ' updateConfig-4.1 workspaceConfig=' + JSON.stringify(workspaceConfig))
	log.info(isoDate() + ' updateConfig-4.3 currentValue=' + JSON.stringify(currentValue))
	log.info(isoDate() + ' updateConfig-4.4        value=' + JSON.stringify(value))

	if (!value) {
		log.info(isoDate() + ' updateConfig-5.1.1 unset key=' + key + ', ' + section2)
		const t = workspaceConfig.inspect(section2)
		log.info(isoDate() + ' updateConfig-5.1.2 t=' + JSON.stringify(t))
		value = t?.defaultValue
		if (JSON.stringify(value) === JSON.stringify(currentValue)) {
			log.info(section1 + '.' + section2 + ' is already set to default value \'' + value + '\'')
			log.info(key + ' is already set to default value \'' + value + '\' /')
			return newTruePromise()
		}
	}
	log.info(isoDate() + ' updateConfig-5.1.3 currentValue=' + JSON.stringify(currentValue))
	log.info(isoDate() + ' updateConfig-5.1.4        value=' + JSON.stringify(value))
	await workspaceConfig.update(section2, value, false).then(() => {
		log.info(isoDate() + ' then!')
		return
	}, (e) => {
		log.error(isoDate() + ' error! err=' + e)
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile['configurations'][0][keys[0]][keys[1]][keys[2]] = value
	} else if (keys.length ===2) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile['configurations'][0][keys[0]][keys[1]] = value
	} else {
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

export async function refreshData () {
	// log.info(isoDate() + ' refreshData-1')
	return commands.executeCommand('_ablunit.getExtensionTestReferences').then((resp) => {
		// log.info(isoDate() + ' refreshData-2')
		const refs = resp as IExtensionTestReferences
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

export async function getCurrentRunData (len = 1, tag?: string) {
	if (tag) {
		tag = '[' + tag + '] '
	} else {
		tag = ''
	}
	log.info(tag + ' start getCurrentRunData')

	await refreshData()
	if (!currentRunData || currentRunData.length === 0) {
		log.info(tag + 'currentRunData not set, refreshing...')
		for (let i=0; i<10; i++) {
			await sleep2(1000, tag + 'still no currentRunData, sleep before trying again').then(async () => {
				return refreshData().then(
					()    => { log.info('refresh success') },
					(err) => { log.error('refresh failed: ' + err) })
			})
			log.info(tag + 'currentRunData.length=' + currentRunData?.length)
			if ((currentRunData?.length ?? 0) > 0) {
				break
			}
		}
		log.info(tag + 'found currentRunData.length=' + currentRunData?.length)
	}
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
	log.info(tag + '107')
	if (!recentResults) {
		log.error(tag + 'recentResults is null')
		throw new Error('recentResults is null')
	}
	if (recentResults.length < len) {
		log.error(tag + 'recent results should be >= ' + len + ' but is ' + recentResults.length)
		throw new Error('recent results should be >= ' + len + ' but is ' + recentResults.length)
	}
	log.info(tag + '110')
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
		this.assertResultsCountByStatus(expectedCount, 'all').catch((err) => { throw err })
	}
	public passed (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'passed').catch((err) => { throw err })
	}
	public errored (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'errored').catch((err) => { throw err })
	}
	public failed (expectedCount: number) {
		this.assertResultsCountByStatus(expectedCount, 'failed').catch((err) => { throw err })
	}
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
	const templateProc = Uri.joinPath(toUri('src/template_proc.p'))
	const templateClass = Uri.joinPath(toUri('src/template_class.cls'))
	const classContent = await workspace.fs.readFile(templateClass).then((data) => {
		return data.toString()
	})

	for (let i = 0; i < 10; i++) {
		await workspace.fs.createDirectory(toUri('src/procs/dir' + i))
		await workspace.fs.createDirectory(toUri('src/classes/dir' + i))
		for (let j = 0; j < 10; j++) {
			await workspace.fs.copy(templateProc, toUri(`src/procs/dir${i}/testProc${j}.p`), { overwrite: true })

			const writeContent = Uint8Array.from(Buffer.from(classContent.replace(/template_class/, `classes.dir${i}.testClass${j}`)))
			await workspace.fs.writeFile(toUri(`src/classes/dir${i}/testClass${j}.cls`), writeContent)
		}
	}
	return sleep(250)
}
