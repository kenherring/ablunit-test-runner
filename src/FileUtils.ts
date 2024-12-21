import * as fs from 'fs'
import JSON_minify from 'node-json-minify'
import { Uri } from 'vscode'
import { log } from 'ChannelLogger'


export function readFileSync (path: string | Uri) {
	return fs.readFileSync(path instanceof Uri ? path.fsPath : path, 'utf8')
}

export function readStrippedJsonFile (uri: Uri | string) {
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


function doesPathExist (uri: Uri, type?: 'file' | 'directory') {
	const exist = fs.existsSync(uri.fsPath)
	if (!exist || !type) {
		return false
	}
	if (type === 'file') {
		return fs.statSync(uri.fsPath).isFile()
	} else if (type === 'directory') {
		return fs.statSync
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
	log.info('cpSYnc: ' + source.fsPath + ' -> ' + target.fsPath)
	log.info(' -- opts=' + JSON.stringify(opts))
	fs.cpSync(source.fsPath, target.fsPath, opts)
}
