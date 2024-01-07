import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { logToChannel, readStrippedJsonFile } from '../ABLUnitCommon'
import { getOpenEdgeProfileConfig, IBuildPathEntry } from './openedgeConfigFile'

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

function getProjectJson (workspaceFolder: WorkspaceFolder) {
	const data = readStrippedJsonFile(Uri.joinPath(workspaceFolder.uri,"openedge-project.json"))
	return JSON.stringify(data)
}

export function getDLC (workspaceFolder: WorkspaceFolder, projectJson?: string) {
	const dlc = dlcMap.get(workspaceFolder)
	if (dlc) {
		return dlc
	}

	let runtimeDlc: Uri | undefined = undefined
	const oeversion = getOEVersion(workspaceFolder, projectJson)
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

export function getOEVersion (workspaceFolder: WorkspaceFolder, projectJson?: string) {
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
		projectJson = getProjectJson(workspaceFolder)
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
