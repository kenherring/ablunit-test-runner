import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { IProjectJson } from './parse/OpenedgeProjectParser'
import { isRelativePath } from './ABLUnitCommon'
import { log } from './ChannelLogger'

interface IPropathEntry {
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

	constructor (workspaceFolder: WorkspaceFolder) {
		this.workspaceFolder = workspaceFolder
		this.filemap = new Map()
		this.buildmap = new Map()
	}

	setPropath (importedPropath: IProjectJson) {
		log.debug('importedPropath.length=' + importedPropath.propathEntry.length)

		for (const entry of importedPropath.propathEntry) {
			log.debug('found propath entry: ' + entry.path + ' ' + entry.type + ' ' + entry.buildDir)
			let uri: Uri = Uri.file(entry.path)
			if(isRelativePath(entry.path)) {
				uri = Uri.joinPath(this.workspaceFolder.uri, entry.path)
			}

			let buildUri: Uri = uri
			if (entry.buildDir) {
				buildUri = Uri.file(entry.buildDir)
				if(isRelativePath(entry.buildDir)) {
					buildUri = Uri.joinPath(this.workspaceFolder.uri, entry.buildDir)
				}
			}

			let xrefDirUri: Uri = uri
			if (entry.xrefDir) {
				xrefDirUri = Uri.file(entry.xrefDir)
				if(isRelativePath(entry.xrefDir)) {
					xrefDirUri = Uri.joinPath(this.workspaceFolder.uri, entry.xrefDir)
				}
			}

			let rel: string | undefined
			rel = workspace.asRelativePath(uri, false)
			if(uri.fsPath === rel) {
				rel = undefined
			}

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

				const fileObj: IABLFile = {
					uri: uri,
					file: relativeFile,
					rcodeUri: rcodeUri,
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: Uri.joinPath(e.xrefDirUri, propathRelativeFile + '.xref')
				}
				this.files.push(fileObj)
				this.filemap.set(relativeFile, fileObj)
				this.buildmap.set(relativeFile, e.buildDirUri.fsPath)
				return fileObj
			}
		}
		return undefined
	}

	async search (file: string | Uri) {
		if (file instanceof Uri) {
			return this.searchUri(file)
		}
		let relativeFile = file
		if (!relativeFile.endsWith('.cls') && !relativeFile.endsWith('.p') && !relativeFile.endsWith('.w') && !relativeFile.endsWith('.i')) {
			relativeFile = relativeFile.replace(/\./g, '/') + '.cls'
		}

		const got = this.filemap.get(relativeFile)
		if (got) {
			return got
		}

		for (const e of this.propath.entry) {
			const fileInPropathUri = Uri.joinPath(e.uri, relativeFile)
			const exists = await workspace.fs.stat(fileInPropathUri).then(() => { return true }, () => { return false })

			if (exists) {
				let propathRelativeFile = fileInPropathUri.fsPath.replace(e.uri.fsPath, '')
				if (propathRelativeFile != fileInPropathUri.fsPath) {
					propathRelativeFile = propathRelativeFile.substring(1)
				}
				const fileObj: IABLFile = {
					uri: fileInPropathUri,
					file: file,
					rcodeUri: Uri.joinPath(e.buildDirUri, relativeFile.replace(/\.(p|cls)$/, '.r')),
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: Uri.joinPath(e.xrefDirUri, propathRelativeFile + '.xref')
				}
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
