import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { logToChannel } from '../ABLUnitCommon'
require("jsonminify")


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
	version?: string
}

const dlcMap = new Map<WorkspaceFolder, IDlc>()


export interface IProjectJson {
	propathEntry: IPropathEntry[]
}

async function getProjectJson (workspaceFolder: WorkspaceFolder) {
	const data = await workspace.fs.readFile(Uri.joinPath(workspaceFolder.uri,"openedge-project.json")).then((raw) => {
		return JSON.minify(Buffer.from(raw.buffer).toString())
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
	const projectJson2 = await getProjectJson(workspaceFolder)
	if (projectJson2) {
		const dlc = await getDLC(workspaceFolder, projectJson2)
		const ret = parseOpenEdgeProjectJson(workspaceFolder, projectJson2, dlc)
		return ret
	}

	logToChannel("Failed to parse openedge-project.json", 'warn')
	return <IProjectJson>{ propathEntry: [] }
}

export async function getOEVersion (workspaceFolder: WorkspaceFolder, projectJson?: string) {
	if (!projectJson) {
		projectJson = await getProjectJson(workspaceFolder)
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

interface IBuildPath {
	path: string
	type: string
	build: string
	xref: string
}

function parseOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder, inConf: string, dlc: IDlc) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const conf = <object>JSON.parse(inConf)

	let buildPath: IBuildPath[] | undefined
	let buildDirectory: string | undefined
	if (typeof conf === 'object') {
		if (Object.prototype.hasOwnProperty.call(conf,'buildPath')) {
			// @ts-expect-error 123
			buildPath = <IBuildPath[]>conf['buildPath']
		}
		if (Object.prototype.hasOwnProperty.call(conf,'buildDirectory')) {
			// @ts-expect-error 123
			buildDirectory = <string>conf['buildDirectory']
		}
	}

	// TODO what about if we're running a different profile?
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

		let buildDir: string = entry.build
		if (!buildDir) {
			buildDir = path
			if (buildDirectory) {
				buildDir = buildDirectory
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
