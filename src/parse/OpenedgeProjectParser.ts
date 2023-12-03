import { Uri, workspace, WorkspaceFolder } from 'vscode';
import jsonminify = require('jsonminify')

export interface IPropathEntry {
	path: string
	type: string
	buildDir: string
	xrefDir: string
}

export interface IProjectJson {
	propathEntry: IPropathEntry[]
}

export async function readOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder) {
	return workspace.fs.readFile(Uri.joinPath(workspaceFolder.uri, "openedge-project.json")).then((data) => {
		const projectJson = JSON.parse(jsonminify(data.toString()))
		return parseOpenEdgeProjectJson(workspaceFolder, projectJson)
	})
}

export async function getOEVersion (workspaceFolder: WorkspaceFolder) {
	return workspace.fs.readFile(Uri.joinPath(workspaceFolder.uri,"openedge-project.json")).then((data) => {
		const projectJson = JSON.parse(jsonminify(data.toString()))
		if (projectJson.oeversion) {
			return projectJson.oeversion.toString()
		}
		return "none"
	})
}

function parseOpenEdgeProjectJson (workspaceFolder: WorkspaceFolder, conf: any) {
	//TODO what about if we're running a different profile?
	if (!conf.buildPath) {
		throw new Error("buildPath not found in openedge-project.json")
	}

	const pj: IProjectJson = { propathEntry: []}

	for (const entry of conf.buildPath) {
		let dotPct: string

		let path: string = entry.path
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
