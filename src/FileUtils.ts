import * as fs from 'fs'
import JSON_minify from 'node-json-minify'
import { FileSystemError, Uri, workspace } from 'vscode'
import { log } from 'ChannelLogger'
import { RmOptions } from 'fs'

export function readFileSync (path: string | Uri, opts?: { encoding?: null; flag?: string; } | null) {
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
			throw FileSystemError.FileNotFound(path)
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
		throw new FileSystemError('No basedir provided for relative path: ' + path)
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
			throw FileSystemError.FileNotADirectory(uri)
		}
		fs.mkdirSync(uri.fsPath, { recursive: true })
	}
}

function deletePath (type: 'directory' | 'file', uris: Uri[], options: RmOptions = { force: true, recursive: true }) {
	if (!uris) {
		return
	}
	if (uris.length == 0) {
		return
	}

	if (!options) {
		options = { recursive: true }
	} else if (options.recursive !== undefined) {
		options.recursive = true
	}

	for (const uri of uris) {
		if (!uri) {
			continue
		}
		try {
			fs.rmSync(uri.fsPath, options)
		} catch (e: unknown) {
			log.info('104')
			if (e instanceof Error) {
				log.info('105')
				const err = e as FileSystemError
				log.info('deletePath: ' + err.message + ' options=' + JSON.stringify(options))
				log.info('106')
				if (err.code == 'ENOENT') {
					log.info('107')
					log.debug('deletePath: ' + type + ' does not exist: ' + uri.fsPath)
					log.info('108')
					// throw FileSystemError.FileNotFound(uri)
				} else {
					log.info('109')
					throw err
				}
			}
		}
	}
	log.info('103')
}

export function deleteFile (file: Uri | Uri[] | undefined, options?: RmOptions) {
	let files: Uri[] = []
	if (file instanceof Uri) {
		files = [file]
	} else if (file) {
		files = file
	}
	// deletePath('file', file, options)
	deletePath('file', files, options)
}

export function deleteDir (dir: Uri | Uri[] | undefined, options?: RmOptions) {
	let dirs: Uri[] = []
	if (dir instanceof Uri) {
		dirs = [dir]
	} else if (dir) {
		dirs = dir
	}
	deletePath('directory', dirs, options)
}

export function copyFile (source: Uri, target: Uri, opts?: fs.CopySyncOptions) {
	if (!doesFileExist(source)) {
		log.warn('copyFile failed! source file does not exist: ' + source.fsPath)
	}
	fs.cpSync(source.fsPath, target.fsPath, opts)
}
