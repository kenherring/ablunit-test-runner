import * as fs from 'fs'
import { Uri } from 'vscode'
import JSON_minify from 'node-json-minify'

export type vscodeVersion = 'stable' | 'insiders' | 'proposedapi'

export const readStrippedJsonFile = (uri: Uri | string) => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret = JSON.parse(JSON_minify(contents)) as object
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

export function deleteFile (file: Uri | Uri[] | undefined) {
	if (!file) {
		return
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
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (err) { /* do nothing */ }
	}
}

export class Duration {
	name?: string
	start: number
	end: number
	runtime?: number
	private stopped = false
	constructor (name?: string) {
		this.name = name
		this.start = Date.now()
		this.end = this.start
	}

	reset () {
		this.start = Date.now()
		this.end = this.start
		this.stopped = false
	}

	elapsed = () => {
		if (!this.stopped) {
			this.end = Date.now()
		}
		return this.end - this.start
	}

	stop () {
		this.end = Date.now()
		this.stopped = true
		this.runtime = this.end - this.start
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
