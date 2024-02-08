import * as fs from 'fs'
import { Uri, workspace } from 'vscode'
// @ts-expect-error 123
import JSON_minify from 'node-json-minify'

export type vscodeVersion = 'stable' | 'insiders' | 'proposedapi'

export const readStrippedJsonFile = (uri: Uri | string): JSON => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret: JSON = JSON.parse(JSON_minify(contents))
	return ret
}

export function isRelativePath (path: string) {
	if(path.startsWith('/') || RegExp(/^[a-zA-Z]:[\\/]/).exec(path)) {
		return false
	} else {
		return true
	}
}

export function doesDirExist (uri: Uri) {
	if (fs.statSync(uri.fsPath).isDirectory()) {
		return true
	}
	return false
}

export function doesFileExist (uri: Uri) {
	if (fs.statSync(uri.fsPath).isFile()) {
		return true
	}
	return false
}

function getWorkspaceUri () {
	if (workspace.workspaceFolders === undefined || workspace.workspaceFolders.length === 0) {
		throw new Error('workspace.workspaceFolders is undefined')
	} else if (workspace.workspaceFolders.length === 1) {
		return workspace.workspaceFolders[0].uri
	} else {
		throw new Error('workspace.workspaceFolders has more than one entry')
	}
}


export function deleteFile (file: Uri | Uri[] | string) {
	if (typeof file === 'string') {
		file = Uri.joinPath(getWorkspaceUri(), file)
	}
	let files: Uri[]
	if (!Array.isArray(file)) {
		files = [file]
	} else {
		files = file
	}
	for (const file of files) {
		try{
			if (doesFileExist(file)) {
				fs.rmSync(file.fsPath)
			}
		} catch (err) { /* do nothing */ }
	}
}

export class Duration {
	start: number
	end: number
	private stopped = false
	constructor () {
		this.start = Date.now()
		this.end = this.start
	}

	elapsed () {
		if (!this.stopped) {
			this.end = Date.now()
		}
		return this.end - this.start
	}

	stop () {
		this.stopped = true
		this.end = Date.now()
	}

	toString () {
		return '(duration=' + this.elapsed() + 'ms)'
	}
}

// export async function doesFileExistAsync (uri: Uri) {
// 	const ret = await workspace.fs.stat(uri).then((stat) => {
// 		if (stat.type === FileType.File) {
// 			return true
// 		}
// 		return false
// 	}, () => {
// 		return false
// 	})
// 	return ret
// }

// export async function doesDirExistSync (uri: Uri) {
// 	const ret = await workspace.fs.stat(uri).then((stat) => {
// 		if (stat.type === FileType.Directory) {
// 			return true
// 		}
// 		return false
// 	}, () => {
// 		return false
// 	})
// 	return ret
// }
