import * as fs from 'fs'
import { ABLResults } from '../ABLResults'
import { ConfigurationTarget, TestController, WorkspaceFolder, commands, extensions, Uri, workspace } from 'vscode'
import { Decorator } from '../Decorator'
import { Duration, deleteFile, isRelativePath, readStrippedJsonFile } from '../ABLUnitCommon'
import { GlobSync } from 'glob'
import { IExtensionTestReferences } from '../extension'
import { ITestSuites } from '../parse/ResultsParser'
import { log } from '../ChannelLogger'
import { strict as assertParent } from 'assert'

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

class TestInfo {
	get projName () { return __filename.split('\\').pop()!.split('/').pop()!.split('.')[0] }
}
export const info = new TestInfo()

export let decorator: Decorator
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
	const d = new Duration()
	log.info('waitForExtensionActive-10 ' + d.toString())
	const ext = extensions.getExtension(extensionId)
	if (!ext) {
		throw new Error(extensionId + " is not installed")
	}

	log.info('waitForExtensionActive-20 ' + d.toString())
	if (!ext.isActive) {
		await ext.activate().then(() => {
			console.log("activated " + extensionId)
		}, (err) => {
			throw new Error("failed to activate kherring.ablunit-test-runner: " + err)
		})
	}

	log.info('waitForExtensionActive-30 ' + d.toString())
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

	log.info('waitForExtensionActive-40 ' + d.toString())
	if (!ext.isActive) {
		throw new Error(extensionId + " is not active")
	}
	console.log(extensionId + " is active!")

	log.info('waitForExtensionActive-50 ' + d.toString())
	const refs = await commands.executeCommand('_ablunit.getExtensionTestReferences').then((resp) => {
		log.info('waitForExtensionActive-51')
		return resp as IExtensionTestReferences
	})
	log.info('waitForExtensionActive-52 ' + d.toString())

	decorator = refs.decorator
	log.info('waitForExtensionActive51 decorator=' + JSON.stringify(decorator))
	testController = refs.testController
	log.info('waitForExtensionActive51 testController=' + JSON.stringify(testController))
	log.debug('got extension references... ready for tests ' + d.toString())
}

async function installOpenedgeABLExtension () {
	if (!extensions.getExtension("riversidesoftware.openedge-abl-lsp")) {
		log.debug("[testCommon.ts] installing riversidesoftware.openedge-abl-lsp extension...")
		await commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
			log.trace("[testCommon.ts] installed riversidesoftware.openedge-abl-lsp extension!")
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
			await sleep(1000)
			return true
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

export function deleteTestFiles () {
	const workspaceUri = getWorkspaceUri()
	deleteFile(Uri.joinPath(workspaceUri, "ablunit.json"))
	deleteFile(Uri.joinPath(workspaceUri, "results.json"))
	deleteFile(Uri.joinPath(workspaceUri, "results.xml"))
}

export function getSessionTempDir () {
	if (process.platform === 'win32') {
		return "file:///c:/temp/ablunit"
	} else if(process.platform === 'linux') {
		return "file:///tmp/ablunit"
	} else {
		throw new Error("Unsupported platform: " + process.platform)
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
		console.log("testing.refreshTests starting")
		await commands.executeCommand('testing.refreshTests').then(() => {
			console.log("testing.refreshTests complete!")
		}, (err) => {
			throw new Error("testing.refreshTests failed: " + err)
		})
		await sleep(500)
	} else {
		await sleep(250)
	}

	console.log("testing.runAll starting")
	return commands.executeCommand('testing.runAll').then(() => {
		console.log("testing.runAll complete!")
	} , (err) => {
		throw new Error("testing.runAll failed: " + err)
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

export function updateTestProfile (key: string, value: string | string[] | boolean): Thenable<void> {
	const profile = readStrippedJsonFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json'))
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

export function getRecentResults (len: number = 1) {
	const recentResults = decorator.getRecentResults()
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

export async function getExtensionReferences () {
	return commands.executeCommand('_ablunit.getExe').then((resp) => {
		if (resp) {
			return resp as ABLResults[]
		}
		throw new Error('no recent results returned from \'ablunit.getExtensionReferences\' command')
	}, (err) => {
		throw new Error('error calling \'ablunit.getExtensionReferences\' command. err=' + err)
	})
}

export function getTestController () {
	return testController
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
		const recentResults = getRecentResults()
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
			this.assert(doesFileExist(dir), "dir does not exist: " + workspace.asRelativePath(dir))
		}
	}
	public notDirExists = (...dirs: string[] | Uri[]) => {
		for (const dir of dirs) {
			this.assert(!doesFileExist(dir), "dir exists: " + workspace.asRelativePath(dir))
		}
	}
}

export const assert = new AssertResults()
