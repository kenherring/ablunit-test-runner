import { strict as assertParent } from 'assert'
import * as fs from 'fs'
import { globSync } from 'glob'
import * as vscode from 'vscode'
import {
	ConfigurationTarget, TestController,
	TestItemCollection,
	Uri,
	WorkspaceFolder, commands, extensions,
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

// eslint-disable-next-line no-console
console.log('process.args=' + process.argv.join(' '))
// eslint-disable-next-line no-console
console.log('extensionDevelopmentPath=' + getExtensionDevelopmentPath().fsPath)


interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

// https://github.com/microsoft/vscode/blob/2aae82a102da66e566842ff9177bceeb99873970/src/vs/workbench/browser/actions/workspaceCommands.ts#L156C1-L163C2
interface IOpenFolderAPICommandOptions {
	forceNewWindow?: boolean
	forceReuseWindow?: boolean
	noRecentEntry?: boolean
	forceLocalWindow?: boolean
	forceProfile?: string
	forceTempProfile?: boolean
}

class TestInfo {
	get projName () { return __filename.split('\\').pop()!.split('/').pop()!.split('.')[0] }
}
export const info = new TestInfo()
export const log = logObj
export {
	Duration,
	Uri, commands, workspace
}

let recentResults: ABLResults[] | undefined
let decorator: Decorator | undefined
let testController: TestController | undefined
let currentRunData: ABLResults[] | undefined

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

export async function sleep (time = 2000, msg?: string) {
	let status = 'sleeping for ' + time + 'ms'
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

// export async function openWorkspaceFolder (dir: string | Uri) {
// 	let uriOfWorkspace: Uri
// 	if (typeof dir === 'string') {
// 		if (dir === '') {
// 			uriOfWorkspace = Uri.joinPath(getExtensionDevelopmentPath(), 'test_projects')
// 		} else {
// 			uriOfWorkspace = Uri.joinPath(getExtensionDevelopmentPath(), 'test_projects', dir)
// 		}
// 	} else {
// 		uriOfWorkspace = dir
// 	}
// 	// const openFolderOpts: boolean = false
// 	const openFolderOpts: IOpenFolderAPICommandOptions = {
// 		// forceNewWindow: false,
// 		forceReuseWindow: true,
// 		// noRecentEntry: true,
// 		// forceLocalWindow: true,
// 		// forceProfile: 'default',
// 		// forceTempProfile: false
// 	}
// 	const beforeUri = vscode.workspace.workspaceFolders?.[0].uri.fsPath
// 	const ret = await vscode.commands.executeCommand('vscode.openFolder', uriOfWorkspace, openFolderOpts).then((ret) => {
// 		const afterUri = vscode.workspace.workspaceFolders?.[0].uri.fsPath
// 		if (beforeUri === afterUri) {
// 			log.error('failed to open workspace folder: beforeUri=' + beforeUri + ', afterUri=' + afterUri)
// 			// throw new Error('failed to open workspace folder: beforeUri=' + beforeUri + ', afterUri=' + afterUri)
// 		}
// 		return true
// 	}, (err) => {
// 		log.error('failed to open workspace folder: ' + err)
// 		throw new Error('failed to open workspace folder: ' + err)
// 	})
// 	log.info('length=' + workspace.workspaceFolders?.length + ', workspaceFolder=' + workspace.workspaceFolders![0].uri.fsPath + ', file=' + workspace.workspaceFile?.fsPath)
// }

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
			await sleep(100)
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

export async function installExtension (extname = 'riversidesoftware.openedge-abl-lsp') {
	log.info('[testCommon.ts installExtension] start')
	if (!extensions.getExtension(extname)) {
		log.info('[testCommon.ts installExtension] installing ' + extname + ' extension...')
		await commands.executeCommand('workbench.extensions.installExtension', extname).then(() => {
			log.trace('[testCommon.ts installExtension] installed riversidesoftware.openedge-abl-lsp extension!')
		}, (err: Error) => {
			log.info('err.name=' + err.name)
			log.info('err.toString()=' + err.toString())
			if (err.toString() === 'Error: Missing gallery') {
				log.trace('[testCommon.ts installExtension] triggered installed extension, caught \'Missing Gallery\' error, and continuing...')
			} else {
				throw new Error('[testCommon.ts installExtension] failed to install extension: ' + err)
			}
		})
		log.info('sleeping for 5 seconds')
		await sleep(10000).then(() => {
			log.info('sleep complete')
		})
	}

	const ext = extensions.getExtension(extname)
	if (!ext) {
		throw new Error('[testCommon.ts installExtension] failed to get extension')
	}
	if (ext.isActive) {
		log.info('[testCommon.ts installExtension] extension is already active')
		return
	}
	log.trace('[testCommon.ts installExtension] activating ' + extname + ' extension...')
	await ext.activate().then(() => waitForExtensionActive(extname)).then(() => {
		log.trace('[testCommon.ts] activated ' + extname + ' extension!')
	})

	log.trace('[testCommon.ts installExtension] ' + extname + ' active=' + ext.isActive)
	if (!ext.isActive) {
		throw new Error('[testCommon.ts] failed to activate extension ' + extname)
	}

	await setRuntimes([{name: '12.2', path: getDefaultDLC(), default: true}])
}

export async function setRuntimes (runtimes: IRuntime[]) {
	log.info('[testCommon.ts setRuntimes] setting abl.configuration.runtimes')
	log.info('[testCommon.ts setRuntimes] runtimes=' + JSON.stringify(runtimes))

	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	if (!ext) {
		throw new Error('[testCommon.ts setRuntimes] extension not installed: riversidesoftware.openedge-abl-lsp')
	}
	if (!ext.isActive) {
		throw new Error('[testCommon.ts setRuntimes] extension not active: riversidesoftware.openedge-abl-lsp')
	}

	return workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(async () =>{
		log.info('[testCommon.ts setRuntimes] abl.configuration.runtimes set successfully')
		await sleep(500)
		log.info('[testCommon.ts setRuntimes] rebuilding abl project...')
		await  commands.executeCommand('abl.project.rebuild').then(() => {
			log.info('[testCommon.ts setRuntimes] abl.project.rebuild command complete!')
		})
		const rt = workspace.getConfiguration('abl.configuration').get('runtimes')
		log.info('runtimes=' + JSON.stringify(rt, null, 2))
	}, (err) => {
		throw new Error('[testCommon.ts setRuntimes] failed to set runtimes: ' + err)
	})
}

export async function installAndSetRuntimes (runtimes: IRuntime[]) {
	return installExtension('riversidesoftware.openedge-abl-lsp').then(async () => {
		log.info('[testCommon.ts setRuntimes] setting abl.configuration.runtimes')
		return workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(async () =>{
			log.info('[testCommon.ts setRuntimes] abl.configuration.runtimes set successfully')
			await commands.executeCommand('abl.restart.langserv').then(() => {
				log.info('abl.restart.langserv complete')
			})
			await sleep(500)
			log.trace('[testCommon.ts setRuntimes] rebuilding abl project...')
			await commands.executeCommand('abl.project.rebuild').then(() => {
				log.trace('[testCommon.ts setRuntimes] abl.project.rebuild command complete!')
			})

			await sleep(500)
			await commands.executeCommand('abl.dumpFileStatus').then(() => {
				log.info('abl.dumpFileStatus complete!')
			})
			await commands.executeCommand('abl.dumpLangServStatus').then(() => {
				log.info('abl.dumpLangServStatus complete!')
			})
		}, (err) => {
			throw new Error('[testCommon.ts setRuntimes] failed to set runtimes: ' + err)
		})
	})
}

export async function awaitRCode (workspaceFolder: WorkspaceFolder, rcodeCountMinimum = 1) {
	const buildWaitTime = 20
	let fileCount = 0
	log.info('waiting up to ' + buildWaitTime + ' seconds for r-code')
	for (let i = 0; i < buildWaitTime; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1000))

		const g = globSync('**/*.r', { cwd: workspaceFolder.uri.fsPath })
		fileCount = g.length
		log.info('(' + i + '/' + buildWaitTime + ') found ' + fileCount + ' r-code files...')
		if (fileCount >= rcodeCountMinimum) {
			log.info('found ' + fileCount + ' r-code files! ready to test')
			return fileCount
		}
		log.info('found ' + fileCount + ' r-code files. waiting...')
		log.info('found files: ' + JSON.stringify(g, null, 2))
	}

	await commands.executeCommand('abl.dumpFileStatus').then(() => {
		log.info('abl.dumpFileStatus complete!')
	})
	await commands.executeCommand('abl.dumpLangServStatus').then(() => {
		log.info('abl.dumpLangServStatus complete!')
	})
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

export function doesFileExist (uri: Uri | string) {
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

export async function runAllTests (doRefresh = true) {

	log.info('running all tests')
	if (doRefresh) {
		await refreshTests().then(() => { return sleep(500, 'after refreshTests') })
	} else {
		await sleep(250, 'sleep before testing.runAll')
	}

	log.info('testing.runAll starting')
	return commands.executeCommand('testing.runAll').then(() => {
		log.info('testing.runAll complete!')
		return refreshData()
	}, (err) => {
		throw new Error('testing.runAll failed: ' + err)
	})
}

export function refreshTests () {
	return commands.executeCommand('testing.refreshTests').then(() => {
		log.info('testing.refreshTests completed!')
	}, (err) => {
		log.info('testing.refreshTests caught an exception. err=' + err)
		throw err
	})
}

export async function waitForTestRunStatus (waitForStatusStartsWith: string) {
	const waitTime = new Duration()
	let runData: ABLResults[] = []
	let runStatus = 'not found'

	log.info('waiting for test run status = \'running\'')

	setTimeout(() => { throw new Error('waitForTestRunStatus timeout') }, 20000)
	while (!runStatus.startsWith(waitForStatusStartsWith))
	{
		await sleep(100, 'waitForTestRunStatus runStatus=\'' + runStatus + '\'')
		runData = await getCurrentRunData()
		runStatus = runData[0].status
	}

	log.info('found test run status = \'' + runStatus + '\'' + waitTime.toString())
	if (!runStatus.startsWith(waitForStatusStartsWith)) {
		throw new Error('test run status should start with ' + waitForStatusStartsWith + ' but is ' + runStatus)
	}
}

export async function cancelTestRun (resolveCurrentRunData = true) {
	const startCancelTime = Date.now()
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
		const elapsedCancelTime = Date.now() - startCancelTime
		log.info('elapsedCancelTime=' + elapsedCancelTime)
		return elapsedCancelTime
	})
}

export function updateConfig (key: string, value: string | string[] | undefined) {
	// log.info('updateConfig-1 key=' + key + ', value=' + value)
	const workspaceConfig = workspace.getConfiguration('ablunit', workspace.workspaceFolders![0])
	// log.info('updateConfig-2 workspaceConfig = ' + JSON.stringify(workspaceConfig, null, 2))
	log.info('updateConfig-2.1 ' + key + ' = ' + workspaceConfig.get(key))
	const prom = workspaceConfig.update(key, value, ConfigurationTarget.Workspace)
	// log.info('updateConfig-3')
	return prom.then(() => {
		// log.info('updateConfig-4')
		log.info('ablunit.' + key + ' set successfully (value=\'' + value + '\')')
		return sleep(100, 'sleep after updateConfig')
	}, (err) => {
		// log.info('updateConfig-5')
		log.warn('failed to set ablunit.' + key + ': ' + err)
		// throw new Error('failed to set ablunit.' + key + ': ' + err)
	})
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
		// @ts-expect-error 123
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile['configurations'][0][keys[0]][keys[1]][keys[2]] = value
	} else if (keys.length ===2) {
		// @ts-expect-error 123
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		profile['configurations'][0][keys[0]][keys[1]] = value
	} else {
		// @ts-expect-error 123
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
		return commands.executeCommand('abl.restart.langserv').then(() => {
			return sleep(500)
		}, (err) => {
			throw new Error('failed to restart langserv: ' + err)
		})
	})
}

export async function refreshData () {
	return commands.executeCommand('_ablunit.getExtensionTestReferences').then((resp) => {
		const refs = resp as IExtensionTestReferences
		decorator = refs.decorator
		testController = refs.testController
		recentResults = refs.recentResults
		if (refs.currentRunData) {
			currentRunData = refs.currentRunData
		}
	}, (err) => {
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

export async function getCurrentRunData (len = 1) {
	log.info('100')
	await refreshData()
	if (!currentRunData || currentRunData.length === 0) {
		log.info('currentRunData not set, refreshing...')
		for (let i=0; i<200; i++) {
			await sleep(100, 'still no currentRunData, sleep before trying again').then(() => {
				return refreshData()
			})
			log.info('currentRunData.length=' + currentRunData?.length)
			if ((currentRunData?.length ?? 0) > 0) {
				break
			}
		}
		log.info('found currentRunData.length=' + currentRunData?.length)
	}
	if (!currentRunData) {
		throw new Error('currentRunData is null')
	}
	if (currentRunData.length === 0) {
		throw new Error('recent results should be > 0')
	}
	if (currentRunData.length !== len) {
		throw new Error('recent results should be ' + len + ' but is ' + currentRunData.length)
	}
	return currentRunData
}

export async function getResults (len = 1) {
	if ((!recentResults || recentResults.length === 0) && len > 0) {
		log.info('recentResults not set, refreshing...')
		for (let i=0; i<15; i++) {
			await sleep(100, 'still no recentResults, sleep before trying again').then(() => {
				return refreshData()
			})
			if ((recentResults?.length ?? 0) > 0) {
				continue
			}
		}
	}
	log.info('107')
	if (!recentResults) {
		throw new Error('recentResults is null')
	}
	if (recentResults.length < len) {
		throw new Error('recent results should be >= ' + len + ' but is ' + recentResults.length)
	}
	return recentResults
}

class AssertResults {

	assert = (value: unknown, message?: string) => { assertParent(value, message) }
	equal = (actual: unknown, expected: unknown, message?: string) => {
		if (actual instanceof Uri) {
			actual = actual.fsPath
		}
		if (expected instanceof Uri) {
			expected = expected.fsPath
		}
		assertParent.equal(actual, expected, message)
	}
	notEqual = (actual: unknown, expected: unknown, message?: string) => { assertParent.notEqual(actual, expected, message) }
	strictEqual = (actual: unknown, expected: unknown, message?: string) => { assertParent.strictEqual(actual, expected, message) }
	notStrictEqual = (actual: unknown, expected: unknown, message?: string) => { assertParent.notStrictEqual(actual, expected, message) }
	deepEqual = (actual: unknown, expected: unknown, message?: string) => { assertParent.deepEqual(actual, expected, message) }
	notDeepEqual = (actual: unknown, expected: unknown, message?: string) => { assertParent.notDeepEqual(actual, expected, message) }
	fail (message?: string): never { assertParent.fail(message) }
	ok = (value: unknown, message?: string) => { assertParent.ok(value, message) }
	ifError = (value: unknown) => { assertParent.ifError(value) }
	throws = (block: () => void, message?: string) => { assertParent.throws(block, message) }
	doesNotThrow = (block: () => void, message?: string) => { assertParent.doesNotThrow(block, message) }

	async assertResultsCountByStatus (expectedCount: number, status: 'passed' | 'failed' | 'errored' | 'all') {
		const recentResults = await getResults()
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const res = recentResults[0].ablResults?.resultsJson[0]
		if (!res) {
			assertParent.fail('No results found. Expected ' + expectedCount + ' ' + status + ' tests')
			return
		}

		let actualCount = -1
		switch (status) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			case 'passed': actualCount = res.passed; break
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			case 'failed': actualCount = res.failures; break
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			case 'errored': actualCount = res.errors; break
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			case 'all': actualCount = res.tests; break
		}
		assert.equal(expectedCount, actualCount, 'test count != ' + expectedCount)
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

	public fileExists = (...files: string[] | Uri[]) => {
		for (const file of files) {
			this.assert(doesFileExist(file), 'file does not exist: ' + workspace.asRelativePath(file))
		}
	}
	public notFileExists = (...files: string[] | Uri[]) => {
		for (const file of files) {
			this.assert(!doesFileExist(file), 'file exists: ' + workspace.asRelativePath(file))
		}
	}
	public dirExists = (...dirs: string[] | Uri[]) => {
		for (const dir of dirs) {
			this.assert(doesDirExist(dir), 'dir does not exist: ' + workspace.asRelativePath(dir))
		}
	}
	public notDirExists = (...dirs: string[] | Uri[]) => {
		for (const dir of dirs) {
			this.assert(!doesDirExist(dir), 'dir exists: ' + workspace.asRelativePath(dir))
		}
	}
}

export const assert = new AssertResults()

export async function beforeProj7 () {
	await waitForExtensionActive()
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
	return sleep(100)
}
