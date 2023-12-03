import { ConfigurationTarget, FileType, Uri, commands, extensions, workspace } from 'vscode'

export function getWorkspaceUri () {
	if (workspace.workspaceFolders === undefined || workspace.workspaceFolders.length === 0) {
		throw new Error("workspace.workspaceFolders is undefined")
	} else if (workspace.workspaceFolders.length === 1) {
		return workspace.workspaceFolders[0].uri
	} else {
		throw new Error("workspace.workspaceFolders has more than one entry")
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

export async function sleep (time: number = 2000) {
	console.log("sleeping for " + time + "ms")
	return new Promise(resolve => setTimeout(resolve, time))
}

export async function deleteFile(uri: Uri) {
	return workspace.fs.delete(uri)
}

export async function doesFileExist(uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.File) {
			return true
		}
		return false
	}, (err) => {
		return false
	})
	return ret
}

export async function doesDirExist(uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.Directory) {
			return true
		}
		return false
	}, (err) => {
		return false
	})
	return ret
}

export async function getTestCount(resultsJson: Uri) {
	const count = await workspace.fs.readFile(resultsJson).then((content) => {
		const str = Buffer.from(content.buffer).toString();
		const results = JSON.parse(str)
		return results[0].tests
	})
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
		}, (err) => {
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
	await sleep(100)

	console.log("running all tests")
	if (doRefresh) {
		console.log("testing.refreshTests starting")
		await commands.executeCommand('testing.refreshTests')
		console.log("testing.refreshTests complete")
	}

	await sleep(500)

	console.log("testing.runAll starting")
	return commands.executeCommand('testing.runAll').then(() => {
		console.log("testing.runAll complete!")
	} , (err) => {
		throw new Error("testing.runAll failed: " + err)
	})
}
