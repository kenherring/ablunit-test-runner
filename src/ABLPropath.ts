import { Uri, workspace, WorkspaceFolder } from 'vscode'
import { IProjectJson } from 'parse/OpenedgeProjectParser'
import { log } from 'ChannelLogger'
import * as FileUtils from 'FileUtils'

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
	rcodeDirectory: Uri,
	rcodeUri: Uri
	relativeFile: string
	propathEntry: IPropathEntry
	propathRelativeFile: string
	xrefUri: Uri
	debugListingUri: Uri
}

export interface IPropath {
	entry: IPropathEntry[]
}

export class PropathParser {
	filemap: Map<string, IABLFile>
	files: IABLFile[] = []
	workspaceFolder: WorkspaceFolder

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
		let uri

		if (this.workspaceFolder) {
			uri = this.workspaceFolder.uri
		} else {
			FileUtils.toUri('.')
		}

		if (!uri) {
			log.error('uri is undefined (workspaceFolder=' + this.workspaceFolder?.uri.fsPath + ')')
			throw new Error('uri is undefined (workspaceFolder=' + this.workspaceFolder?.uri.fsPath + ')')
		}

		this.propath.entry.push({
			uri: uri,
			path: uri.fsPath,
			relativePath: '.',
			buildDir: uri.fsPath,
			buildDirUri: uri,
			xrefDir: uri.fsPath,
			xrefDirUri: uri,
			type: 'Source',
		})
	}

	setPropath (importedPropath: IProjectJson) {
		log.debug('importedPropath.length=' + importedPropath.propathEntry.length)

		this.propath.entry = []

		for (const entry of importedPropath.propathEntry) {
			log.debug('found propath entry: ' + entry.path + ' ' + entry.type + ' ' + entry.build)
			let uri: Uri = Uri.file(entry.path)
			if(FileUtils.isRelativePath(entry.path)) {
				uri = Uri.joinPath(this.workspaceFolder.uri, entry.path)
			}

			let buildUri: Uri = uri
			if (entry.build) {
				buildUri = Uri.file(entry.build)
				if(FileUtils.isRelativePath(entry.build)) {
					buildUri = Uri.joinPath(this.workspaceFolder.uri, entry.build)
				}
			}

			let xrefDirUri: Uri = uri
			if (entry.xref) {
				xrefDirUri = Uri.file(entry.xref)
				if(FileUtils.isRelativePath(entry.xref)) {
					xrefDirUri = Uri.joinPath(this.workspaceFolder.uri, entry.xref)
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
				buildDir: entry.build,
				uri: uri,
				relativePath: rel,
				buildDirUri: buildUri,
				xrefDir: entry.xref,
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

	private searchUri (uri: Uri) {
		for (const e of this.propath.entry) {
			if(uri.fsPath.replace(/\\/g, '/').startsWith(e.uri.fsPath.replace(/\\/g, '/') + '/')) {
				const propathRelativeFile = uri.fsPath.replace(e.uri.fsPath, '').substring(1)
				const relativeFile = workspace.asRelativePath(uri, false)
				const rcodeUri = Uri.joinPath(e.buildDirUri, propathRelativeFile.replace(/\.(p|cls)$/, '') + '.r')
				const xrefUri = Uri.joinPath(e.xrefDirUri, propathRelativeFile + '.xref')
				const debugListingUri = Uri.joinPath(e.buildDirUri, propathRelativeFile.replace(/\.(p|cls)$/, '') + '.dbg')

				const fileObj: IABLFile = {
					uri: uri,
					file: relativeFile,
					rcodeDirectory: e.buildDirUri,
					rcodeUri: rcodeUri,
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: xrefUri,
					debugListingUri: debugListingUri,
				}
				this.files.push(fileObj)
				this.filemap.set(relativeFile, fileObj)
				return fileObj
			}
		}
		return undefined
	}

	search (file: string | Uri | undefined) {
		if (!file) {
			return undefined
		}
		if (file instanceof Uri) {
			return this.searchUri(file)
		}

		let relativeFile = FileUtils.isRelativePath(file) ? file : workspace.asRelativePath(Uri.file(file), false)
		if (!relativeFile.endsWith('.cls') && !relativeFile.endsWith('.p') && !relativeFile.endsWith('.w') && !relativeFile.endsWith('.i') && !relativeFile.endsWith('.r')) {
			relativeFile = relativeFile.replace(/\./g, '/') + '.cls'
		}

		const got = this.filemap.get(relativeFile)
		if (got) {
			return got
		}

		for (const e of this.propath.entry) {
			const fileInPropathUri = Uri.joinPath(e.uri, relativeFile)
			const exists = FileUtils.doesFileExist(fileInPropathUri)

			if (exists) {
				let propathRelativeFile = fileInPropathUri.fsPath.replace(e.uri.fsPath, '')
				if (propathRelativeFile != fileInPropathUri.fsPath) {
					propathRelativeFile = propathRelativeFile.substring(1)
				}
				const fileObj: IABLFile = {
					uri: fileInPropathUri,
					file: file,
					rcodeDirectory: e.buildDirUri,
					rcodeUri: Uri.joinPath(e.buildDirUri, propathRelativeFile.replace(/\.(p|cls)$/, '') + '.r'),
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: Uri.joinPath(e.xrefDirUri, propathRelativeFile + '.xref'),
					debugListingUri: Uri.joinPath(e.buildDirUri, propathRelativeFile + '.dbg'),
				}
				this.files.push(fileObj)
				this.filemap.set(relativeFile, fileObj)
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
