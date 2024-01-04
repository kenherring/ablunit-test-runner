import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'
import { getOpenEdgeProfileConfig, IBuildPathEntry } from './openedgeConfigFile'
require("jsonminify")


interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export interface IDlc {
	uri: Uri,
	version?: string
}

export interface IProjectJson {
	propathEntry: IBuildPathEntry[]
}

const dlcMap = new Map<WorkspaceFolder, IDlc>()

async function getProjectJson (workspaceFolder: WorkspaceFolder) {
	const data = await workspace.fs.readFile(Uri.joinPath(workspaceFolder.uri,"openedge-project.json")).then((raw) => {
		return JSON.minify(Buffer.from(raw.buffer).toString())
	}, (err) => {
		logToChannel("Failed to read openedge-project.json: " + err,'error')
		return undefined
	})
	if (data) {
		if (!JSON.parse(data)) {
			logToChannel("Failed to parse openedge-project.json", 'error')
			return undefined
		}
		return data
	}
	return undefined
}

export async function getDLC (workspaceFolder: WorkspaceFolder, projectJson?: string) {
	const dlc = dlcMap.get(workspaceFolder)
	if (dlc) {
		return dlc
	}

	let runtimeDlc: Uri | undefined = undefined
	const oeversion = await getOEVersion(workspaceFolder, projectJson)
	const runtimes: IRuntime[] = workspace.getConfiguration("abl.configuration").get("runtimes",[])

	for (const runtime of runtimes) {
		if (runtime.name === oeversion) {
			runtimeDlc = Uri.file(runtime.path)
			break
		}
		if (runtime.default) {
			runtimeDlc = Uri.file(runtime.path)
		}
	}
	if (!runtimeDlc && process.env.DLC) {
		runtimeDlc = Uri.file(process.env.DLC)
	}
	if (runtimeDlc) {
		logToChannel("using DLC = " + runtimeDlc.fsPath)
		const dlcObj: IDlc = { uri: runtimeDlc }
		dlcMap.set(workspaceFolder, dlcObj)
		return dlcObj
	}
	throw new Error("unable to determine DLC")
}

export async function readOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder) {
	const projectJson = await getProjectJson(workspaceFolder)
	if (projectJson) {
		const dlc = await getDLC(workspaceFolder, projectJson)
		const ret = parseOpenEdgeProjectJson(workspaceFolder, projectJson, dlc)
		return ret
	}

	logToChannel("Failed to parse openedge-project.json", 'warn')
	return <IProjectJson>{ propathEntry: [] }
}

export async function getOEVersion (workspaceFolder: WorkspaceFolder, projectJson?: string) {
	const profileJson = getOpenEdgeProfileConfig(workspaceFolder.uri)
	if (!profileJson) {
		logToChannel("[getOEVersion] profileJson not found", 'debug')
		return undefined
	}

	if (profileJson.oeversion) {
		logToChannel("[getOEVersion] profileJson.value.oeversion = " + profileJson.oeversion, 'debug')
		return profileJson.oeversion
	}

	if (!projectJson) {
		projectJson = await getProjectJson(workspaceFolder)
		if (!projectJson) {
			return undefined
		}
	}
	if(projectJson) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const tmpVer: string = JSON.parse(projectJson).oeversion
		if(tmpVer) {
			return tmpVer
		}
	}
	return undefined
}

function parseOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder, inConf: string, dlc: IDlc) {
	const conf = getOpenEdgeProfileConfig(workspaceFolder.uri)
	if (!conf) {
		logToChannel("Failed to parse openedge-project.json", 'warn')
		return <IProjectJson>{ propathEntry: [] }
	}

	const buildPath = conf.buildPath ?? []
	if (!buildPath) {
		logToChannel("buildPath not found in openedge-project.json", 'error')
		throw new Error("buildPath not found in openedge-project.json")
	}

	const pj: IProjectJson = { propathEntry: []}

	for (const entry of buildPath) {
		let dotPct: string

		let path: string = entry.path.replace('${DLC}', dlc.uri.fsPath)
		if (path === ".") {
			path = workspaceFolder.uri.fsPath
		} else if (path.startsWith("./")) {
			path = workspaceFolder.uri.fsPath + path.substring(1)
		}

		let buildDir: string = entry.buildDir
		if (!buildDir) {
			buildDir = path
			dotPct = ".builder/.pct0"
		} else {
			dotPct = buildDir + "/.pct"
		}
		if (!buildDir) {
			throw new Error("buildDirectory not found in openedge-project.json")
		}

		let xrefDir: string = entry.xrefDir
		if (!xrefDir) {
			xrefDir = dotPct
		}

		pj.propathEntry.push({
			path: path,
			type: entry.type.toLowerCase(),
			buildDir: buildDir,
			xrefDir: xrefDir
		})
	}
	return pj
}
