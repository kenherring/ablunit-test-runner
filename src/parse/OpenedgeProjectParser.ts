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
		if (!JSON.parse(data)) {
			logToChannel("Failed to parse openedge-project.json", 'error')
			return undefined
		}
		return data
	}
	return undefined
}

export async function getDLC(workspaceFolder: WorkspaceFolder, projectJson?: string) {
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
		console.log("using DLC = " + runtimeDlc.fsPath)
		const dlcObj: IDlc = { uri: runtimeDlc, version: oeversion }
		dlcMap.set(workspaceFolder, dlcObj)
		return dlcObj
	}
	throw new Error("unable to determine DLC")
}

export async function readOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	console.log("1000")
	const projectJson = await getProjectJson(workspaceFolder)
	console.log("1001")
	if (projectJson) {
		const dlc = await getDLC(workspaceFolder, projectJson)
		console.log("1002")
		const ret = parseOpenEdgeProjectJson(workspaceFolder, projectJson, dlc)
		console.log("1003")
		return ret
	}

	logToChannel("openedge-project.json not found.", 'warn')
	return <IProjectJson>{ propathEntry: [] }
}

export async function getOEVersion (workspaceFolder: WorkspaceFolder, projectJson?: string) {
	if (!projectJson) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		projectJson = await getProjectJson(workspaceFolder)
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if(projectJson) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const tmpVer: string = JSON.parse(projectJson).oeversion
		if(tmpVer) {
			return tmpVer
		}
	}
	return "none"
	//TODO return undefined
}

function parseOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder, inConf: string, dlc: IDlc) {
	const conf = JSON.parse(inConf)

	//TODO what about if we're running a different profile?
	if (!conf.buildPath) {
		console.error("buildPath not found in openedge-project.json")
		console.error("openedge-project.json: " + JSON.stringify(conf, null, 4)) //TODO remove me
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
