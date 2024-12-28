import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { IProjectJson } from './parse/OpenedgeProjectParser'
import { log } from './ChannelLogger'
import * as FileUtils from './FileUtils'

export interface IPropathEntry {
	uri: Uri
	path: string
	relativePath?: string
	type: string
	buildDir: string
	buildDirUri: Uri
	xrefDir: string
	xrefDirUri: Uri
}

export interface IABLFile {
	uri: Uri
	file: string
	rcodeUri: Uri
	relativeFile: string
	propathEntry: IPropathEntry
	propathRelativeFile: string
	xrefUri: Uri
}

export interface IPropath {
	entry: IPropathEntry[]
}

export class PropathParser {
	filemap: Map<string, IABLFile>
	files: IABLFile[] = []
	workspaceFolder: WorkspaceFolder
	buildmap: Map<string, string>

	propath: IPropath = {
		entry: [] as IPropathEntry[]
	}

	constructor (workspaceFolder?: WorkspaceFolder) {
		if (workspaceFolder) {
			this.workspaceFolder = workspaceFolder
		} else {
			this.workspaceFolder = workspace.workspaceFolders![0]
		}
		this.filemap = new Map()
		this.buildmap = new Map()

		this.addPropathDir({
			uri: FileUtils.toUri('.'),
			path: FileUtils.toUri('.').fsPath,
			relativePath: '.',
			buildDir: '.',
			buildDirUri: FileUtils.toUri('.'),
			xrefDir: '.',
			xrefDirUri: FileUtils.toUri('.'),
			type: 'Source',

		})
	}

	addPropathDir (entry: IPropathEntry) {
		this.propath.entry.push(entry)
	}

	setPropath (importedPropath: IProjectJson) {
		log.debug('importedPropath.length=' + importedPropath.propathEntry.length)

		this.propath.entry = []

		for (const entry of importedPropath.propathEntry) {
			log.debug('found propath entry: ' + entry.path + ' ' + entry.type + ' ' + entry.buildDir)
			let uri: Uri = Uri.file(entry.path)
			if(FileUtils.isRelativePath(entry.path)) {
				uri = Uri.joinPath(this.workspaceFolder.uri, entry.path)
			}

			let buildUri: Uri = uri
			log.info('entry.buildDir=' + entry.buildDir)
			log.info('buildUri=' + buildUri)
			if (entry.buildDir) {
				buildUri = Uri.file(entry.buildDir)
				log.info('buildUri=' + buildUri)
				if(FileUtils.isRelativePath(entry.buildDir)) {
					buildUri = Uri.joinPath(this.workspaceFolder.uri, entry.buildDir)
					log.info('relative')
					log.info('buildUri=' + buildUri)
				}
			}

			let xrefDirUri: Uri = uri
			if (entry.xrefDir) {
				xrefDirUri = Uri.file(entry.xrefDir)
				if(FileUtils.isRelativePath(entry.xrefDir)) {
					xrefDirUri = Uri.joinPath(this.workspaceFolder.uri, entry.xrefDir)
				}
			}

			let rel: string | undefined
			rel = workspace.asRelativePath(uri, false)
			if(uri.fsPath === rel) {
				rel = undefined
			}

			log.info('PROPATH ENTRY')
			log.info(' - path=' + entry.path)
			log.info(' - uri=' + uri)
			log.info(' - buildDirUri=' + buildUri)
			const e: IPropathEntry = {
				path: entry.path,
				type: entry.type,
				buildDir: entry.buildDir,
				uri: uri,
				relativePath: rel,
				buildDirUri: buildUri,
				xrefDir: entry.xrefDir,
				xrefDirUri: xrefDirUri
			}
			// log.info("push entry=" + e.path + " " + e.uri.fsPath)
			this.propath.entry.push(e)
		}
		log.debug('propath=' + this.toString())
	}

	getPropath () {
		return this.propath
	}

	getBuildDir (filepath: string) {
		return this.buildmap.get(filepath)
	}

	async getRCodeUri (filepath: string) {
		let bd = this.buildmap.get(filepath)

		if (!bd) {
			const found = await this.search(filepath)
			if (found) {
				bd = this.buildmap.get(filepath)
			}
		}

		if (!bd) {
			throw new Error('cannot find build dir for ' + filepath)
		}

		const rpath = Uri.joinPath(Uri.file(bd), filepath.replace(/\.(p|cls)$/, '.r'))
		return rpath
	}

	private searchUri (uri: Uri) {
		for (const e of this.propath.entry) {
			if(uri.fsPath.replace(/\\/g, '/').startsWith(e.uri.fsPath.replace(/\\/g, '/') + '/')) {
				const propathRelativeFile = uri.fsPath.replace(e.uri.fsPath, '').substring(1)
				const relativeFile = workspace.asRelativePath(uri, false)
				const rcodeUri = Uri.joinPath(e.buildDirUri, relativeFile.replace(/\.(p|cls)$/, '.r'))
				const xrefUri = Uri.joinPath(e.xrefDirUri, propathRelativeFile + '.xref')

				const fileObj: IABLFile = {
					uri: uri,
					file: relativeFile,
					rcodeUri: rcodeUri,
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: xrefUri
				}
				this.files.push(fileObj)
				this.filemap.set(relativeFile, fileObj)
				this.buildmap.set(relativeFile, e.buildDirUri.fsPath)
				return fileObj
			}
		}
		return undefined
	}

	async search (file: string | Uri | undefined) {
		if (!file) {
			return undefined
		}
		// let uri: Uri | undefined = undefined
		if (file instanceof Uri) {
			return this.searchUri(file)
			// uri = file
			// file = file.fsPath
		}

		let relativeFile = FileUtils.isRelativePath(file) ? file : workspace.asRelativePath(Uri.file(file), false)
		log.info('relativeFile=' + relativeFile)
		if (!relativeFile.endsWith('.cls') && !relativeFile.endsWith('.p') && !relativeFile.endsWith('.w') && !relativeFile.endsWith('.i')) {
			relativeFile = relativeFile.replace(/\./g, '/') + '.cls'
		}
		log.info('relativeFile=' + relativeFile)

		const got = this.filemap.get(relativeFile)
		if (got) {
			log.info('got')
			return got
		}

		for (const e of this.propath.entry) {
			const fileInPropathUri = Uri.joinPath(e.uri, relativeFile)
			// if (uri && uri.fsPath !== fileInPropathUri.fsPath) {
			// 	continue
			// }
			log.info('searching for ' + fileInPropathUri.fsPath)
			const exists = await workspace.fs.stat(fileInPropathUri).then(() => { return true }, () => { return false })
			log.info('exists? ' + exists)

			if (exists) {
				let propathRelativeFile = fileInPropathUri.fsPath.replace(e.uri.fsPath, '')
				if (propathRelativeFile != fileInPropathUri.fsPath) {
					propathRelativeFile = propathRelativeFile.substring(1)
				}
				const fileObj: IABLFile = {
					uri: fileInPropathUri,
					file: file,
					rcodeUri: Uri.joinPath(e.buildDirUri, propathRelativeFile.replace(/\.(p|cls)$/, '.r')),
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: Uri.joinPath(e.xrefDirUri, propathRelativeFile + '.xref')
				}
				log.info('rcodeUri=' + fileObj.rcodeUri)
				this.files.push(fileObj)
				this.filemap.set(relativeFile, fileObj)
				this.buildmap.set(relativeFile, e.buildDirUri.fsPath)
				return fileObj
			}
		}
		if (!file) {
			log.error('(search) cannot find \'' + file + '\' in propath')
			throw new Error('(search) cannot find \'' + file + '\' in propath')
		}
	}

	toString () {
		const paths: string[] = []
		for (const entry of this.propath.entry) {
			paths.push(entry.path)
		}
		return paths.join(',')
	}

}
