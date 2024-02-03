import * as fs from 'fs'
import { ABLResults } from '../ABLResults'
import { ConfigurationTarget, TestController, WorkspaceFolder, commands, extensions, Uri, workspace, TestItemCollection } from 'vscode'
import { Decorator } from '../Decorator'
import { Duration, deleteFile, isRelativePath, readStrippedJsonFile } from '../ABLUnitCommon'
import { GlobSync } from 'glob'
import { IExtensionTestReferences } from '../extension'
import { ITestSuites } from '../parse/ResultsParser'
import { log as logObj } from '../ChannelLogger'
import { strict as assertParent } from 'assert'
import { DefaultRunProfile } from '../parse/config/RunProfile'
import { IConfigurations } from '../parse/TestProfileParser'

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

class TestInfo {
	get projName () { return __filename.split('\\').pop()!.split('/').pop()!.split('.')[0] }
}
export const info = new TestInfo()
export const log = logObj

let recentResults: ABLResults[] | undefined
let decorator: Decorator | undefined
let testController: TestController | undefined
let currentRunData: ABLResults[] | undefined

export function beforeCommon () {
	recentResults = undefined
	decorator = undefined
	testController = undefined
	currentRunData = undefined
}

export {
	deleteFile
}

export function sleep (time = 2000, msg?: string) {
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

async function installOpenedgeABLExtension () {
	if (!extensions.getExtension('riversidesoftware.openedge-abl-lsp')) {
		log.debug('[testCommon.ts] installing riversidesoftware.openedge-abl-lsp extension...')
		await commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
			log.trace('[testCommon.ts] installed riversidesoftware.openedge-abl-lsp extension!')
			return setRuntimes([{name: '12.2', path: getDefaultDLC(), default: true}])
		}, (err: Error) => {
			if (err.toString() === 'Error: Missing gallery') {
				log.trace('[testCommon.ts] triggered installed extension, but caught \'' + err + '\'')
			} else {
				throw new Error('[testCommon.ts] failed to install extension: ' + err)
			}
		})
		await sleep(500)
	}

	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	if (!ext) {
		throw new Error('[testCommon.ts] failed to get extension')
	}
	log.trace('[testCommon.ts] activating riversidesoftware.openedge-abl-lsp extension...')
	await ext.activate().then(() => waitForExtensionActive('riversidesoftware.openedge-abl-lsp')).then(() => {
		log.trace('[testCommon.ts] activated riversidesoftware.openedge-abl-lsp extension!')
	})

	log.trace('[testCommon.ts] riversidesoftware.openedge-abl-lsp active=' + ext.isActive)
	if (!ext.isActive) {
		throw new Error('[testCommon.ts] failed to activate extension')
	}
}

export async function setRuntimes (runtimes: IRuntime[]) {
	return installOpenedgeABLExtension().then(async () => {
		log.info('[testCommon.ts] setting abl.configuration.runtimes')
		return workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(async () =>{
			log.info('[testCommon.ts] abl.configuration.runtimes set successfully')
			return sleep(500)
		}, (err) => {
			throw new Error('[testCommon.ts] failed to set runtimes: ' + err)
		})
	})
}

export async function awaitRCode (workspaceFolder: WorkspaceFolder, rcodeCountMinimum = 1) {
	const buildWaitTime = 20
	let fileCount = 0
	log.info('waiting up to' + buildWaitTime + ' seconds for r-code')
	for (let i = 0; i < buildWaitTime; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1000))

		const g = new GlobSync('**/*.r', { cwd: workspaceFolder.uri.fsPath })
		fileCount = g.found.length
		log.info('(' + i + '/' + buildWaitTime + ') found ' + fileCount + ' r-code files...')
		if (fileCount >= rcodeCountMinimum) {
			log.info('found ' + fileCount + ' r-code files! ready to test')
			return fileCount
		}
		log.info('found ' + fileCount + ' r-code files. waiting...')
		log.info('found files: ' + JSON.stringify(g.found, null, 2))
	}

	await commands.executeCommand('abl.dumpFileStatus').then(() => {
		log.info('abl.dumpFileStatus complete!')
	})
	await commands.executeCommand('abl.dumpLangServStatus').then(() => {
		log.info('abl.dumpLangServStatus complete!')
	})
	throw new Error('r-code files not found')
}

export function getWorkspaceUri () {
	if (workspace.workspaceFolders === undefined || workspace.workspaceFolders.length === 0) {
		throw new Error('workspace.workspaceFolders is undefined')
	} else if (workspace.workspaceFolders.length === 1) {
		return workspace.workspaceFolders[0].uri
	} else {
		throw new Error('workspace.workspaceFolders has more than one entry')
	}
}

export function toUri (uri: string | Uri) {
	if (uri instanceof Uri) {
		return uri
	}

	if (isRelativePath(uri)) {
		return Uri.joinPath(getWorkspaceUri(), uri)
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

	log.debug('waiting for test run status = \'running\'')

	setTimeout(() => { throw new Error('waitForTestRunStatus timeout') }, 20000)
	while (!runStatus.startsWith(waitForStatusStartsWith))
	{
		await sleep(100, 'waitForTestRunStatus runStatus=\'' + runStatus + '\'')
		runData = await getCurrentRunData()
		runStatus = runData[0].status
	}

	log.debug('found test run status = \'' + runStatus + '\'' + waitTime.toString())
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
		log.debug('cancelling test run (STATUS=' + await status + ')')
	} else {
		log.debug('cancelling test run')
	}

	return commands.executeCommand('testing.cancelRun').then(() => {
		const elapsedCancelTime = Date.now() - startCancelTime
		log.debug('elapsedCancelTime=' + elapsedCancelTime)
		return elapsedCancelTime
	})
}

export function updateConfig (key: string, value: string | string[] | undefined) {
	return workspace.getConfiguration('ablunit').update(key, value, ConfigurationTarget.Workspace).then(() => {
		log.info('ablunit.' + key + ' set successfully (value=\'' + value + '\')')
		return sleep(100, 'sleep after updateConfig')
	}, (err) => {
		throw new Error('failed to set ablunit.' + key + ': ' + err)
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
		// decorator = refs.decorator
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
	log.debug('100')
	await refreshData()
	if (!currentRunData || currentRunData.length === 0) {
		log.debug('currentRunData not set, refreshing...')
		for (let i=0; i<200; i++) {
			await sleep(100, 'still no currentRunData, sleep before trying again').then(() => {
				return refreshData()
			})
			log.debug('currentRunData.length=' + currentRunData?.length)
			if ((currentRunData?.length ?? 0) > 0) {
				break
			}
		}
		log.debug('found currentRunData.length=' + currentRunData?.length)
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
		log.debug('recentResults not set, refreshing...')
		for (let i=0; i<15; i++) {
			await sleep(100, 'still no recentResults, sleep before trying again').then(() => {
				return refreshData()
			})
			if ((recentResults?.length ?? 0) > 0) {
				continue
			}
		}
	}
	log.debug('107')
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
