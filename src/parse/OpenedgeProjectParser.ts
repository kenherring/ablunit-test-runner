import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'


interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export interface IPropathEntry {
	path: string
	type: string
	buildDir: string
	xrefDir: string
}

export interface IDlc {
	uri: Uri,
	version: string
}

const dlcMap = new Map<WorkspaceFolder, IDlc>()


export interface IProjectJson {
	propathEntry: IPropathEntry[]
}

async function getProjectJson (workspaceFolder: WorkspaceFolder) {
	const data = await workspace.fs.readFile(Uri.joinPath(workspaceFolder.uri,"openedge-project.json")).then((raw) => {
		return Buffer.from(raw.buffer).toString().replace(/\r/g,'').replace(/\/\/.*/g,'')
	}, (err) => {
		logToChannel("Failed to parse openedge-project.json: " + err,'error')
		return undefined
	})
	if (data) {
		return JSON.parse(data)
	}
	return undefined
}

export async function getDLC(workspaceFolder: WorkspaceFolder, projectJson?: any) {
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
		console.log("using DLC = " + runtimeDlc)
		const dlcObj: IDlc = { uri: runtimeDlc, version: oeversion }
		dlcMap.set(workspaceFolder, dlcObj)
		return dlcObj
	}
	throw new Error("unable to determine DLC")
}

export async function readOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder) {
	const projectJson = await getProjectJson(workspaceFolder)
	const dlc = await getDLC(workspaceFolder, projectJson)
	return parseOpenEdgeProjectJson(workspaceFolder, projectJson, dlc)
}

export async function getOEVersion (workspaceFolder: WorkspaceFolder, projectJson?: any) {
	if (!projectJson) {
		projectJson = await getProjectJson(workspaceFolder)
	}
	if (projectJson.oeversion) {
		return projectJson.oeversion.toString()
	}
	return "none"
}

function parseOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder, conf: any, dlc: IDlc) {
	//TODO what about if we're running a different profile?
	if (!conf.buildPath) {
		throw new Error("buildPath not found in openedge-project.json")
	}

	const pj: IProjectJson = { propathEntry: []}

	for (const entry of conf.buildPath) {
		let dotPct: string

		let path: string = entry.path.replace('${DLC}',dlc.uri)
		if (path === ".") {
			path = workspaceFolder.uri.fsPath
		} else if (path.startsWith("./")) {
			path = workspaceFolder.uri.fsPath + path.substring(1)
		}

		let buildDir: string = entry.build
		if (!buildDir) {
			buildDir = path
			if (conf.buildDirectory) {
				buildDir = conf.buildDirectory
			}
			dotPct = ".builder/.pct0"
		} else {
			dotPct = buildDir + "/.pct"
		}
		if (!buildDir) {
			throw new Error("buildDirectory not found in openedge-project.json")
		}

		let xrefDir: string = entry.xref
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
