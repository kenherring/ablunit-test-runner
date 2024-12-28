import * as fs from 'fs'
import JSON_minify from 'node-json-minify'
import { Uri, workspace } from 'vscode'
import { log } from 'ChannelLogger'

class FileNotFoundError extends Error {
	public uri: Uri | undefined = undefined

	constructor (public readonly path: string | Uri) {
		super('file not found: ' + path)
		this.name = 'ABLUnitRuntimeError'
		if (path instanceof Uri) {
			this.uri = path
			this.path = path.fsPath
		} else {
			this.path = path
			if (isRelativePath(path)) {
				this.uri = Uri.joinPath(workspace.workspaceFolders![0].uri, path)
			} else {
				this.uri = Uri.file(path)
			}
		}
	}
}

export function readFileSync (path: string | Uri, opts?: { encoding?: null; flag?: string; } | null) {
	return fs.readFileSync(path instanceof Uri ? path.fsPath : path, opts)
}

export function readLinesFromFileSync (uri: Uri) {
	const content = readFileSync(uri).toString()
	const lines = content.replace(/\r/g, '').split('\n')
	return lines
}

export function readStrippedJsonFile (uriOrPath: Uri | string) {
	let path: string
	if (uriOrPath instanceof Uri) {
		path = uriOrPath.fsPath
	} else {
		path = uriOrPath
	}
	const contents = fs.readFileSync(path, 'utf8')
	// eslint-disable-next-line
	const ret = JSON.parse(JSON_minify(contents)) as object
	return ret
}

export function writeFile (path: string | Uri, data: string | Uint8Array, options?: fs.WriteFileOptions) {
	if (path instanceof Uri) {
		path = path.fsPath
	}
	fs.writeFileSync(path, data, options)
}

export function validateFile (path: string | Uri) {

	if (path instanceof Uri) {
		if (!doesFileExist(path)) {
			throw new FileNotFoundError(path)
		}
		return true
	}
	return true
}

export function toUri (path: string, base?: string) {
	if (base && isRelativePath(path)) {
		let uri = Uri.file(base)
		uri = Uri.joinPath(uri, path)
		return uri
	}
	if (isRelativePath(path)) {
		if (workspace.workspaceFolders?.length == 1) {
			if (path == '.') {
				return workspace.workspaceFolders[0].uri
			}
			return Uri.joinPath(workspace.workspaceFolders[0].uri, path)
		}
		throw new Error('path is relative but no base provided: ' + path)
	}

	return Uri.file(path)
}

export function isRelativePath (path: string) {
	if(path.startsWith('/') || RegExp(/^[a-zA-Z]:[\\/]/).exec(path)) {
		return false
	} else {
		return true
	}
}


function doesPathExist (uri: Uri, type?: 'file' | 'directory') {
	const exist = fs.existsSync(uri.fsPath)
	if (!exist || !type) {
		return false
	}
	if (type === 'file') {
		return fs.statSync(uri.fsPath).isFile()
	} else if (type === 'directory') {
		return fs.statSync(uri.fsPath).isDirectory()
	}
	log.debug('unknown path type=' + type)
	return false
}


export function doesFileExist (uri: Uri) {
	return doesPathExist(uri, 'file')
}


export function doesDirExist (uri: Uri) {
	return doesPathExist(uri, 'directory')
}

export function createDir (uri: Uri) {
	if (!doesPathExist(uri, 'directory')) {
		if (doesPathExist(uri)) {
			throw new Error('path exists but is not a directory: ' + uri.fsPath)
		}
		fs.mkdirSync(uri.fsPath, { recursive: true })
	}
}

function deletePath (type: 'directory' | 'file', uris: (Uri | undefined)[]) {
	if (uris.length == 0) {
		return
	}
	for (const uri of uris) {
		if (!uri) {
			continue
		}
		if (doesPathExist(uri, type)) {
			fs.rmSync(uri.fsPath, { recursive: true })
			continue
		}
		if (doesPathExist(uri)) {
			throw new Error('path exists but is not a ' + type + ': ' + uri.fsPath)
		}
	}
}

export function deleteFile (...files: (Uri | undefined)[]) {
	deletePath('file', files)
}

export function deleteDir (...dirs: (Uri | undefined)[]) {
	deletePath('directory', dirs)
}

export function copyFile (source: Uri, target: Uri, opts?: fs.CopySyncOptions) {
	if (!doesFileExist(source)) {
		log.warn('source file does not exist: ' + source.fsPath)
	}
	fs.cpSync(source.fsPath, target.fsPath, opts)
}
