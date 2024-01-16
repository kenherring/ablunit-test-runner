import { ConfigurationTarget, FileType, Uri, commands, extensions, workspace } from 'vscode'
import { ITestSuites } from '../parse/ResultsParser'
import { strict as assert } from 'assert'
import { ABLResults } from 'src/ABLResults'
import { log } from '../ABLUnitCommon'

export async function waitForExtensionActive () {
	const ext = extensions.getExtension("kherring.ablunit-test-runner")
	if (!ext) {
		throw new Error("kherring.ablunit-test-runner is not installed")
	}
	if (!ext.isActive) {
		await ext.activate().then(() => {
			log.info("activated kherring.ablunit-test-runner")
		}, (err) => {
			throw new Error("failed to activate kherring.ablunit-test-runner: " + err)
		})
	}

	if(!ext.isActive) {
		log.info("waiting for extension to activate - should never be here!")
		for (let i=0; i<50; i++) {
			await sleep(100)
			if (ext.isActive) {
				log.info("waitied " + ((i + 1) * 100) + "ms for extension to activate")
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
	log.info(status)
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
	log.info("getTestCount: " + status + " = " + count)
	return count
}

export function getDefaultDLC () {
	log.info("process.platform=" + process.platform)
	if (process.platform === 'linux') {
		return "/psc/dlc"
	}
	return "C:\\Progress\\OpenEdge"
}

async function installOpenedgeABLExtension () {
	if (!extensions.getExtension("riversidesoftware.openedge-abl-lsp")) {
		log.info("[testCommon.ts] installing riversidesoftware.openedge-abl-lsp extension")
		await commands.executeCommand('workbench.extensions.installExtension', 'riversidesoftware.openedge-abl-lsp').then(() => {
		}, (err: Error) => {
			if (err.toString() === 'Error: Missing gallery') {
				log.info("[testCommon.ts] triggered installed extension, but caught '" + err + "'")
			} else {
				throw new Error("[testCommon.ts] failed to install extension: " + err)
			}
		})
	}

	log.info("[testCommon.ts] activating riversidesoftware.openedge-abl-lsp extension")
	await extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.activate()
	while(!extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.isActive) {
		log.info(extensions.getExtension("riversidesoftware.openedge-abl-lsp") + " " + extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.isActive)
		await sleep(500)
	}
	log.info("openedge-abl active? " + !extensions.getExtension("riversidesoftware.openedge-abl-lsp")?.isActive)
}

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export async function setRuntimes (runtimes: IRuntime[]) {
	return installOpenedgeABLExtension().then(() => {

		log.info("[testCommon.ts] setting abl.configuration.runtimes")
		return workspace.getConfiguration('abl.configuration').update('runtimes', runtimes, ConfigurationTarget.Global).then(() =>{
			log.info("[testCommon.ts] abl.configuration.runtimes set successfully")
		}, (err) => {
			throw new Error("[testCommon.ts] failed to set runtimes: " + err)
		}).then(async () => {
			await sleep(500)
			return commands.executeCommand('abl.restart.langserv').then(() => {
				log.info("[testCommon.ts] abl.restart.langserv complete!")
				return sleep(500)
			})
		})
	})
}

export async function runAllTests (doRefresh: boolean = true) {

	log.info("running all tests")
	if (doRefresh) {
		log.info("testing.refreshTests starting")
		await commands.executeCommand('testing.refreshTests').then(() => {
			log.info("testing.refreshTests complete!")
		}, (err) => {
			throw new Error("testing.refreshTests failed: " + err)
		})
		await sleep(500)
	} else {
		await sleep(250)
	}

	log.info("testing.runAll starting")
	return commands.executeCommand('testing.runAll').then(() => {
		log.info("testing.runAll complete!")
	} , (err) => {
		throw new Error("testing.runAll failed: " + err)
	})
}

export function updateConfig (key: string, value: string | string[] | undefined) {
	return workspace.getConfiguration('ablunit').update(key, value, ConfigurationTarget.Workspace).then(() => {
		log.info("ablunit." + key + " set successfully (value='" + value + "')")
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
	async assertResultsCountByStatus (expectedCount: number, status: 'passed' | 'failed' | 'errored' | 'all') {
		const recentResults = await getRecentResults()
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const res = recentResults[0].ablResults?.resultsJson[0]
		if (!res) {
			assert.fail('No results found. Expected ' + expectedCount + ' ' + status + ' tests')
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

export async function getRecentResults () {
	return commands.executeCommand('_ablunit.getRecentResults').then((resp) => {
		if (resp) {
			return <ABLResults[]>resp
		}
		throw new Error('no recent results returned from \'ablunit.getRecentResults\' command')
	}, (err) => {
		log.info("---- err=" + err)
		throw new Error('error calling \'ablunit.getRecentResults\' command')
	})
}
