import { ConfigurationTarget, FileType, Uri, commands, extensions, workspace } from 'vscode'
import { ITestSuites } from '../parse/ResultsParser'
import { strict as assert } from 'assert'
import { recentResults } from '../decorator'

export async function waitForExtensionActive () {
	const ext = extensions.getExtension("kherring.ablunit-test-runner")
	if (!ext) {
		throw new Error("kherring.ablunit-test-runner is not installed")
	}
	if (!ext.isActive) {
		await ext.activate().then(() => {
			console.log("activated kherring.ablunit-test-runner")
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
		throw new Error("kherring.ablunit-test-runner is not active")
	}
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

export async function deleteTestFiles () {
	const workspaceUri = getWorkspaceUri()
	await deleteFile(Uri.joinPath(workspaceUri, "ablunit.json"))
	await deleteFile(Uri.joinPath(workspaceUri, "results.json"))
	await deleteFile(Uri.joinPath(workspaceUri, "results.xml"))
}

export async function deleteFile (file: Uri) {
	if (await doesFileExist(file)) {
		return workspace.fs.delete(file)
	}
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

export function sleep (time: number = 2000, msg?: string) {
	let status = "sleeping for " + time + "ms"
	if (msg) {
		status = status + " [" + msg + "]"
	}
	console.log(status)
	return new Promise(resolve => setTimeout(resolve, time))
}

export async function doesFileExist (uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.File) {
			return true
		}
		return false
	}, () => {
		return false
	})
	return ret
}

export async function doesDirExist (uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.Directory) {
			return true
		}
		return false
	}, () => {
		return false
	})
	return ret
}

export async function getTestCount (resultsJson: Uri, status: string = 'tests') {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const count = await workspace.fs.readFile(resultsJson).then((content) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const results = <ITestSuites[]>JSON.parse(Buffer.from(content.buffer).toString())

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

async function installOpenedgeABLExtension () {
	if (!extensions.getExtension("riversidesoftware.openedge-abl-lsp")) {
		console.log("[indexCommon.ts] installing riversidesoftware.openedge-abl-lsp extension")
		await commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
		}, (err: Error) => {
			if (err.toString() === 'Error: Missing gallery') {
				console.log("[indexCommon.ts] triggered installed extension, but caught '" + err + "'")
			} else {
				throw new Error("[indexCommon.ts] failed to install extension: " + err)
			}
		})
	}

	console.log("[indexCommon.ts] activating riversidesoftware.openedge-abl-lsp extension")
	await extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.activate()
	while(!extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.isActive) {
		console.log(extensions.getExtension("riversidesoftware.openedge-abl-lsp") + " " + extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.isActive)
		await sleep(500)
	}
	console.log("openedge-abl active? " + !extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.isActive)
}

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export async function setRuntimes (runtimes: IRuntime[]) {
	await installOpenedgeABLExtension()

	console.log("[indexCommon.ts] setting abl.configuration.runtimes")
	await workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(() =>{
		console.log("[indexCommon.ts] abl.configuration.runtimes set successfully")
	}, (err) => {
		throw new Error("[indexCommon.ts] failed to set runtimes: " + err)
	})
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
	return workspace.fs.readFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json')).then((content) => {
		const str = Buffer.from(content.buffer).toString()
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const profile = JSON.parse(str)
		const keys = key.split('.')

		if (keys.length === 3) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			profile["configurations"][0][keys[0]][keys[1]][keys[2]] = value
		} else if (keys.length ===2) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			profile["configurations"][0][keys[0]][keys[1]] = value
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			profile["configurations"][0][keys[0]] = value
		}

		// profile.configurations[0][key] = value
		let newtext = JSON.stringify(profile,null,4) + "\n"
		if (process.platform === 'win32') {
			newtext = newtext.replace(/\n/g,'\r\n')
		}
		const newjson = Buffer.from(newtext)
		return workspace.fs.writeFile(Uri.joinPath(getWorkspaceUri(), '.vscode', 'ablunit-test-profile.json'), newjson)
	})
}

export async function selectProfile (profile: string) {
	const profileJson = {
		profile: profile
	}
	const profileUri = Uri.joinPath(getWorkspaceUri(), '.vscode', 'profile.json')
	return workspace.fs.writeFile(profileUri, Buffer.from(JSON.stringify(profileJson))).then(() => {
		return commands.executeCommand('abl.restart.langserv').then(() => {
			return true
		}, (err) => {
			throw new Error("failed to restart langserv: " + err)
		})
	})
}

class AssertResults {
	assertResultsCountByStatus (expectedCount: number, status: 'passed' | 'failed' | 'errored' | 'all') {
		const res = recentResults?.[0].ablResults?.resultsJson[0]
		if (!res) {
			assert.fail('No results found. Expected ' + expectedCount + ' ' + status + ' tests')
		}

		let actualCount: number = -1
		switch (status) {
			case 'passed': actualCount = res.passed; break
			case 'failed': actualCount = res.failures; break
			case 'errored': actualCount = res.errors; break
			case 'all': actualCount = res.tests; break
		}
		assert.equal(expectedCount, actualCount, "test count != " + expectedCount)
	}
	public count = (expectedCount: number) => {
		return this.assertResultsCountByStatus(expectedCount, 'all')
	}
	passed (expectedCount: number) {
		return this.assertResultsCountByStatus(expectedCount, 'passed')
	}
	errored (expectedCount: number) {
		return this.assertResultsCountByStatus(expectedCount, 'errored')
	}
	failed (expectedCount: number) {
		return this.assertResultsCountByStatus(expectedCount, 'failed')
	}
}

export const assertResults = new AssertResults()
