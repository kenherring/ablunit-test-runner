import * as fs from 'fs'
import { ABLResults } from '../ABLResults'
import { ConfigurationTarget, TestController, WorkspaceFolder, commands, extensions, Uri, workspace } from 'vscode'
import { Decorator } from '../Decorator'
import { deleteFile, isRelativePath, readStrippedJsonFile } from '../ABLUnitCommon'
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

let recentResults: ABLResults[]
let decorator: Decorator
let testController: TestController

export {
	deleteFile
}

export function sleep (time: number = 2000, msg?: string) {
	let status = "sleeping for " + time + "ms"
	if (msg) {
		status = status + " [" + msg + "]"
	}
	console.log(status)
	return new Promise(resolve => setTimeout(resolve, time))
}

export function getAblunitExt () {
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	if (!ext) {
		throw new Error("kherring.ablunit-test-runner is not installed")
	}
	return ext
}

export async function waitForExtensionActive (extensionId: string = 'kherring.ablunit-test-runner') {
	const ext = extensions.getExtension(extensionId)
	if (!ext) {
		throw new Error(extensionId + " is not installed")
	}

	if (!ext.isActive) {
		await ext.activate().then(() => {
			console.log("activated " + extensionId)
		}, (err) => {
			throw new Error("failed to activate kherring.ablunit-test-runner: " + err)
		})
	}

	if(!ext.isActive) {
		console.log("waiting for extension to activate - should never be here!")
		for (let i=0; i<50; i++) {
			await sleep(100)
			if (ext.isActive) {
				console.log("waitied " + ((i + 1) * 100) + "ms for extension to activate")
				break
			}
		}
	}

	if (!ext.isActive) {
		throw new Error(extensionId + " is not active")
	}
	console.log(extensionId + " is active!")
	// return refreshData()
}

async function installOpenedgeABLExtension () {
	if (!extensions.getExtension("riversidesoftware.openedge-abl-lsp")) {
		log.debug("[testCommon.ts] installing riversidesoftware.openedge-abl-lsp extension...")
		await commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
			log.trace("[testCommon.ts] installed riversidesoftware.openedge-abl-lsp extension!")
			return setRuntimes([{name: "12.2", path: getDefaultDLC(), default: true}])
		}, (err: Error) => {
			if (err.toString() === 'Error: Missing gallery') {
				log.trace("[testCommon.ts] triggered installed extension, but caught '" + err + "'")
			} else {
				throw new Error("[testCommon.ts] failed to install extension: " + err)
			}
		})
		await sleep(500)
	}

	const ext = extensions.getExtension("riversidesoftware.openedge-abl-lsp")
	if (!ext) {
		throw new Error("[testCommon.ts] failed to get extension")
	}
	log.trace('[testCommon.ts] activating riversidesoftware.openedge-abl-lsp extension...')
	await ext.activate().then(() => waitForExtensionActive('riversidesoftware.openedge-abl-lsp')).then(() => {
		log.trace('[testCommon.ts] activated riversidesoftware.openedge-abl-lsp extension!')
	})

	log.trace('[testCommon.ts] riversidesoftware.openedge-abl-lsp active=' + ext.isActive)
	if (!ext.isActive) {
		throw new Error("[testCommon.ts] failed to activate extension")
	}
}

export async function setRuntimes (runtimes: IRuntime[]) {
	return installOpenedgeABLExtension().then(async () => {
		log.info("[testCommon.ts] setting abl.configuration.runtimes")
		return workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(async () =>{
			log.info("[testCommon.ts] abl.configuration.runtimes set successfully")
			return sleep(500)
		}, (err) => {
			throw new Error("[testCommon.ts] failed to set runtimes: " + err)
		})
	})
}

export async function awaitRCode (workspaceFolder: WorkspaceFolder, rcodeCountMinimum: number = 1) {
	const buildWaitTime = 20
	let fileCount = 0
	console.log("waiting up to" + buildWaitTime + " seconds for r-code")
	for (let i = 0; i < buildWaitTime; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1000))

		const g = new GlobSync('**/*.r', { cwd: workspaceFolder.uri.fsPath })
		fileCount = g.found.length
		console.log("(" + i + "/" + buildWaitTime + ") found " + fileCount + " r-code files...")
		if (fileCount >= rcodeCountMinimum) {
			console.log("found " + fileCount + " r-code files! ready to test")
			return fileCount
		}
		console.log("found " + fileCount + " r-code files. waiting...")
		console.log("found files: " + JSON.stringify(g.found,null,2))
	}

	await commands.executeCommand('abl.dumpFileStatus').then(() => {
		console.log("abl.dumpFileStatus complete!")
	})
	await commands.executeCommand('abl.dumpLangServStatus').then(() => {
		console.log("abl.dumpLangServStatus complete!")
	})
	throw new Error("r-code files not found")
}

export function getWorkspaceUri () {
	if (workspace.workspaceFolders === undefined || workspace.workspaceFolders.length === 0) {
		throw new Error("workspace.workspaceFolders is undefined")
	} else if (workspace.workspaceFolders.length === 1) {
		return workspace.workspaceFolders[0].uri
	} else {
		throw new Error("workspace.workspaceFolders has more than one entry")
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
	deleteFile(Uri.joinPath(workspaceUri, "ablunit.json"))
	deleteFile(Uri.joinPath(workspaceUri, "results.json"))
	deleteFile(Uri.joinPath(workspaceUri, "results.xml"))
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

export async function getTestCount (resultsJson: Uri, status: string = 'tests') {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const count = await workspace.fs.readFile(resultsJson).then((content) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const results: ITestSuites[] = JSON.parse(Buffer.from(content.buffer).toString())

		if (!results || results.length === 0) {
			throw new Error("[getTestCount] no testsuite found in results")
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
			throw new Error("[getTestCount] unknown status: " + status)
		}
	})
	console.log("getTestCount: " + status + " = " + count)
	return count
}

export function getDefaultDLC () {
	if (process.platform === 'linux') {
		return "/psc/dlc"
	}
	return "C:\\Progress\\OpenEdge"
}

export async function runAllTests (doRefresh: boolean = true) {

	console.log("running all tests")
	if (doRefresh) {
		await refreshTests().then(() => { return sleep(500, 'after refreshTests') })
	} else {
		await sleep(250, 'sleep before testing.runAll')
	}

	console.log("testing.runAll starting")
	return commands.executeCommand('testing.runAll').then(() => {
		console.log("testing.runAll complete!")
		return refreshData()
	} , (err) => {
		throw new Error("testing.runAll failed: " + err)
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

export function updateConfig (key: string, value: string | string[] | undefined) {
	return workspace.getConfiguration('ablunit').update(key, value, ConfigurationTarget.Workspace).then(() => {
		console.log("ablunit." + key + " set successfully (value='" + value + "')")
		return sleep(100, "sleep after updateConfig")
	}, (err) => {
		throw new Error("failed to set ablunit." + key + ": " + err)
	})
}

export async function updateTestProfile (key: string, value: string | string[] | boolean) {
	const testProfileUri = Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')
	if (!doesFileExist(testProfileUri)) {
		log.info("creating ablunit-test-profile.json")
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
	let newtext = JSON.stringify(profile,null,4) + "\n"
	if (process.platform === 'win32') {
		newtext = newtext.replace(/\n/g,'\r\n')
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
			throw new Error("failed to restart langserv: " + err)
		})
	})
}

export async function refreshData () {
	return commands.executeCommand('_ablunit.getExtensionTestReferences').then((resp) => {
		const refs = resp as IExtensionTestReferences
		decorator = refs.decorator
		testController = refs.testController
		recentResults = refs.recentResults
		log.debug('refreshData complete!')
	}, (err) => {
		throw new Error("failed to refresh test results: " + err)
	})
}

export function getDecorator () {
	return decorator
}

export function getTestController () {
	return testController
}

export function getResults (len: number = 1) {
	if (!recentResults) {
		throw new Error('recent results is undefined!')
	}
	if (recentResults.length === 0) {
		throw new Error('recent results should be > 0')
	}
	if (recentResults.length !== len) {
		throw new Error('recent results should be ' + len + ' but is ' + recentResults.length)
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

	assertResultsCountByStatus (expectedCount: number, status: 'passed' | 'failed' | 'errored' | 'all') {
		const recentResults = getResults()
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const res = recentResults[0].ablResults?.resultsJson[0]
		if (!res) {
			assertParent.fail('No results found. Expected ' + expectedCount + ' ' + status + ' tests')
			return
		}

		let actualCount: number = -1
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
		assert.equal(expectedCount, actualCount, "test count != " + expectedCount)
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

	public fileExists = (...files: string[] | Uri[]) => {
		for (const file of files) {
			this.assert(doesFileExist(file), "file does not exist: " + workspace.asRelativePath(file))
		}
	}
	public notFileExists = (...files: string[] | Uri[]) => {
		for (const file of files) {
			this.assert(!doesFileExist(file), "file exists: " + workspace.asRelativePath(file))
		}
	}
	public dirExists = (...dirs: string[] | Uri[]) => {
		for (const dir of dirs) {
			this.assert(doesDirExist(dir), "dir does not exist: " + workspace.asRelativePath(dir))
		}
	}
	public notDirExists = (...dirs: string[] | Uri[]) => {
		for (const dir of dirs) {
			this.assert(!doesDirExist(dir), "dir exists: " + workspace.asRelativePath(dir))
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
}
