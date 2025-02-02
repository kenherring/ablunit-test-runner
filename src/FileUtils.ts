import * as fs from 'fs'
import * as fsp from 'fs/promises'
import JSON_minify from 'node-json-minify'
import { FileSystemError, Uri, workspace } from 'vscode'
import { log } from 'ChannelLogger'
import { RmOptions } from 'fs'

export function readFileSync (path: string | Uri, opts?: { encoding?: null; flag?: string; } | null): Buffer {
	try {
		return fs.readFileSync(path instanceof Uri ? path.fsPath : path, opts)
	} catch (e: unknown) {
		// @ts-expect-error this is safe
		switch (e.code) {
			case 'ENOENT':
				throw FileSystemError.FileNotFound(path)
			case 'EACCES':
				throw FileSystemError.NoPermissions('permission denied: ' + path)
			case 'EISDIR':
				throw FileSystemError.FileIsADirectory(path)
			default:
				if (e instanceof Error) {
					const err = e as FileSystemError
					throw err
				}
				throw new FileSystemError('Uncategorized error! e=' + e)
		}
	}
}

export function readLinesFromFileSync (uri: Uri): string[] {
	const content = readFileSync(uri).toString()
	const lines = content.replace(/\r/g, '').split('\n')
	return lines
}

export function readStrippedJsonFile (uriOrPath: Uri | string): object {
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

export function writeFile (path: string | Uri, data: string | Uint8Array, options?: fs.WriteFileOptions): void {
	if (path instanceof Uri) {
		path = path.fsPath
	}
	fs.writeFileSync(path, data, options)
}

export function validateDirectory (path: string | Uri): boolean {
	if (path instanceof Uri) {
		if (!doesDirExist(path)) {
			throw FileSystemError.FileNotFound(path)
		}
		return true
	}
	return true
}

export function validateFile (path: string | Uri): boolean {

	if (path instanceof Uri) {
		if (!doesFileExist(path)) {
			throw FileSystemError.FileNotFound(path)
		}
		return true
	}
	return true
}

export function toUri (uri: string | Uri, base?: string | Uri) {
	if (uri instanceof Uri) {
		return uri
	}
	if (!isRelativePath(uri)) {
		return Uri.file(uri)
	}
	if (base) {
		base = base instanceof Uri ? base : Uri.file(base)
		return Uri.joinPath(base, uri)
	}
	if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
		return Uri.joinPath(workspace.workspaceFolders[0].uri, uri)
	}
	throw new Error('No basedir provided for relative path: ' + uri)
}

export function isRelativePath (path: string): boolean {
	if(path.startsWith('/') || RegExp(/^[a-zA-Z]:[\\/]/).exec(path)) {
		return false
	}
	return true
}

function doesPathExist (uri: Uri | string, type?: 'file' | 'directory'): boolean {
	if (!(uri instanceof Uri)) {
		uri = Uri.file(uri)
	}
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

export function doesFileExist (uri: Uri | string): boolean {
	return doesPathExist(uri, 'file')
}

export function doesDirExist (uri: Uri | string): boolean {
	return doesPathExist(uri, 'directory')
}

export function createDir (uri: Uri | string): void {
	uri = toUri(uri)
	if (!doesPathExist(uri, 'directory')) {
		if (doesPathExist(uri)) {
			throw FileSystemError.FileNotADirectory(uri)
		}
		fs.mkdirSync(uri.fsPath, { recursive: true })
	}
}

function deletePath (type: 'directory' | 'file', uris: Uri[], options: RmOptions = { force: true, recursive: true }): void {
	if (!uris || uris.length == 0) {
		return
	}

	if (options.recursive !== undefined) {
		options.recursive = true
	}

	for (const uri of uris) {
		if (!uri) {
			continue
		}
		try {
			fs.rmSync(uri.fsPath, options)
		} catch (e: unknown) {
			if (e instanceof Error) {
				const err = e as FileSystemError
				if (err.code != 'ENOENT') {
					throw err
				}
				log.debug('deletePath: ' + type + ' does not exist: ' + uri.fsPath)
			} else {
				throw e
			}
		}
	}
}

export function deleteFile (file: Uri | string | undefined | (Uri | string | undefined)[], options?: RmOptions): void {
	if (!file) return
	let files: Uri[] = []
	if (file instanceof Uri) {
		files = [file]
	} else if (typeof file === 'string') {
		files = [toUri(file)]
	} else if (file) {
		files = file.filter((f) => f != undefined).map((f) => toUri(f))
	}
	deletePath('file', files, options)
}

export function deleteDir (dir: Uri | string | undefined | (Uri | undefined)[], options?: RmOptions): void {
	if (typeof dir === 'string') {
		dir = toUri(dir)
	}
	if (!dir) return
	let dirs: Uri[] = []
	if (dir instanceof Uri) {
		dirs = [dir]
	} else if (dir) {
		dirs = dir.filter((d) => d != undefined)
	}
	deletePath('directory', dirs, options)
}

export function copyFile (source: Uri | string, target: Uri | string, _opts?: fs.CopySyncOptions): void {
	source = toUri(source)
	target = toUri(target)
	if (!doesFileExist(source)) {
		log.warn('copyFile failed! source file does not exist: ' + source.fsPath)
	}
	fs.copyFileSync(source.fsPath, target.fsPath)
}

export function copyFileAsync (source: Uri | string, target: Uri | string): Promise<void> {
	source = toUri(source)
	target = toUri(target)
	if (!doesFileExist(source)) {
		log.warn('copyFile failed! source file does not exist: ' + source.fsPath)
		return Promise.resolve()
	}
	return fsp.copyFile(source.fsPath, target.fsPath)
}

export function renameFile (source: Uri | string, target: Uri | string): void {
	source = toUri(source)
	target = toUri(target)
	if (!doesFileExist(source)) {
		log.warn('renameFile failed! source file does not exist: ' + source.fsPath)
		return
	}
	fs.renameSync(source.fsPath, target.fsPath)
}
