import * as fs from 'fs'
import { TestController, TestItem, TestItemCollection, Uri } from 'vscode'
import JSON_minify from 'node-json-minify'
import { ABLResults } from 'ABLResults'
import { log } from 'ChannelLogger'
import path from 'path'

export interface IExtensionTestReferences {
	testController: TestController
	recentResults: ABLResults[]
	currentRunData: ABLResults[]
}

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

function doesPathExist (uri: Uri, type?: 'file' | 'dir') {
	const exist = fs.existsSync(uri.fsPath)
	if (!exist || !type) {
		return false
	}
	if (type === 'file') {
		return fs.statSync(uri.fsPath).isFile()
	} else if (type === 'dir') {
		return fs.statSync
	}
	log.debug('unknown path type=' + type)
	return false
}

export function doesFileExist (uri: Uri) {
	return doesPathExist(uri, 'file')
}


export function doesDirExist (uri: Uri) {
	return doesPathExist(uri, 'dir')
}

export function createDir (uri: Uri) {
	if (!doesPathExist(uri, 'dir')) {
		if (doesPathExist(uri)) {
			throw new Error('path exists but is not a directory: ' + uri.fsPath)
		}
		fs.mkdirSync(uri.fsPath, { recursive: true })
	}
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
		if (doesPathExist(file, 'file')) {
			fs.rmSync(file.fsPath)
			continue
		}
		if (doesPathExist(file)) {
			throw new Error('path exists but is not a file: ' + file.fsPath)
		}
	}
}

export function deleteDir (uri: Uri | Uri[] | undefined) {
	if (!uri) {
		return
	}
	let uris: Uri[]
	if (!Array.isArray(uri)) {
		uris = [uri]
	} else {
		uris = uri
	}
	for (const uri of uris) {
		if (doesPathExist(uri, 'dir')) {
			fs.rmSync(uri.fsPath, { recursive: true })
			continue
		}
		if (doesPathExist(uri)) {
			throw new Error('path exists but is not a directory: ' + uri.fsPath)
		}
	}
}

export function copyFile (source: Uri, target: Uri, opts?: fs.CopySyncOptions) {
	log.info('cpSYnc: ' + source.fsPath + ' -> ' + target.fsPath)
	log.info(' -- opts=' + JSON.stringify(opts))
	fs.cpSync(source.fsPath, target.fsPath, opts)
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

export function gatherAllTestItems (collection: TestItemCollection) {
	const items: TestItem[] = []
	collection.forEach(item => {
		items.push(item, ...gatherAllTestItems(item.children))
	})
	return items
}

export function readOEVersionFile (useDLC: string) {
	const versionFile = path.join(useDLC, 'version')
	if (!doesFileExist(Uri.file(versionFile))) {
		log.debug('version file does not exist: ' + versionFile)
		return undefined
	}
	const dlcVersion = fs.readFileSync(versionFile)
	if (!dlcVersion) {
		log.debug('failed to read version file: ' + versionFile)
		return undefined
	}

	const match = RegExp(/OpenEdge Release (\d+\.\d+)/).exec(dlcVersion.toString())
	if (match) {
		log.info('oeversion from DLC is ' + match[1] + ' (file=' + versionFile + ')')
		return match[1]
	}
	log.debug('failed to parse version file: ' + versionFile + ' (content=' + dlcVersion + ')')
	return undefined
}
