import { Uri, workspace } from 'vscode';
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

export async function readOpenEdgeProjectJson () {
	if (!workspace.workspaceFolders) { return }

	return workspace.fs.readFile(Uri.joinPath(workspace.workspaceFolders[0].uri,"openedge-project.json")).then((data) => {
		const projectJson = JSON.parse(jsonminify(data.toString()));
		return parseOpenEdgeProjectJson(projectJson)
	})
}

function parseOpenEdgeProjectJson (conf: any) {
	//TODO what about if we're running a different profile?
	//TODO import the correct DLC
	if (!conf.buildPath) {
		throw new Error("buildPath not found in openedge-project.json")
	}

	const pj: IProjectJson = { propathEntry: []}

	for (const entry of conf.buildPath) {
		let dotPct: string

		let path: string = entry.path
		if (path === ".") {
			path = workspace.workspaceFolders![0].uri.fsPath
		}

		let buildDir: string = entry.build
		if (!buildDir) {
			if (conf.buildDirectory) {
				buildDir = conf.buildDirectory
			} else {
				buildDir = entry.path
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
			path: entry.path,
			type: entry.type.toLowerCase(),
			buildDir: buildDir,
			xrefDir: xrefDir
		})
	}
	return pj
}
