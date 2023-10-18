import { Uri, workspace } from 'vscode';
import jsonminify = require('jsonminify')

export interface IPropathEntry {
	path: string
	type: string
	buildDir: string
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
	//TODO what about if we're running a differen profile?
	if (!conf.buildPath) {
		throw new Error("buildPath not found in openedge-project.json")
	}

	const pj: IProjectJson = { propathEntry: []}

	for (const entry of conf.buildPath) {
		let type: string = entry.type
		if (entry.type) {
			type = entry.type.toLowerCase()
		}
		let buildDir: string = entry.build
		if (!buildDir) {
			buildDir = conf.buildDirectory
		}
		if (!buildDir) {
			throw new Error("buildDirectory not found in openedge-project.json")
		}
		
		pj.propathEntry.push({
			path: entry.path,
			type: type,
			buildDir: entry.build
		})
	}
	return pj
}
