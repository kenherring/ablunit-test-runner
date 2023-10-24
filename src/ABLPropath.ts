import { Uri, workspace } from 'vscode'
import path = require('path')
import { IProjectJson } from './projectSchema'

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
	uri: Uri,
	file: string
	relativeFile: string,
	propathEntry: IPropathEntry,
	propathRelativeFile: string
	xrefUri: Uri
}

export interface IPropath {
	entry: IPropathEntry[]
}

const ABLFiles: IABLFile[] = []

export class PropathParser {
	filemap: Map<string, IABLFile> = new Map()
	files: IABLFile[] = []
	workspaceUri: Uri
	buildMap: Map<string, string> = new Map()

	propath: IPropath = {
		entry: [] as IPropathEntry[]
	}

	constructor(workspaceUri: Uri) {
		this.workspaceUri = workspaceUri
	}

	async setPropath(importedPropath: IProjectJson) {
		console.log("////////////// setPropath begin //////////////")

		for (const entry of importedPropath.propathEntry) {
			console.log("setPropath: " + entry.path + " " + entry.type + " " + entry.buildDir)
			let uri: Uri
			if(RegExp(/^[a-zA-Z]:/).exec(entry.path)) {
				uri = Uri.file(entry.path)
			} else {
				uri = Uri.joinPath(this.workspaceUri,entry.path)
			}

			let buildUri: Uri
			if(RegExp(/^[a-zA-Z]:/).exec(entry.buildDir)) {
				buildUri = Uri.file(entry.buildDir)
			} else {
				buildUri = Uri.joinPath(this.workspaceUri,entry.buildDir)
			}

			let xrefDirUri: Uri
			if(RegExp(/^[a-zA-Z]:/).exec(entry.xrefDir)) {
				xrefDirUri = Uri.file(entry.xrefDir)
			} else {
				xrefDirUri = Uri.joinPath(this.workspaceUri,entry.xrefDir)
			}

			let rel: string | undefined
			rel = workspace.asRelativePath(uri)
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
			this.propath.entry.push(e)
		}
		console.log("////////////// setPropath end //////////////")
	}

	getPropath() {
		return this.propath
	}

	async getBuildDir(filepath: string) {
		return this.buildMap.get(filepath)
	}

	private async searchUri (uri: Uri) {
		for (const e of this.propath.entry) {
			if(uri.fsPath.startsWith(e.uri.fsPath)) {
				const propathRelativeFile = uri.fsPath.replace(e.uri.fsPath,'').substring(1)
				const relativeFile = workspace.asRelativePath(uri)

				const fileObj: IABLFile = {
					uri: uri,
					file: relativeFile,
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: Uri.joinPath(e.xrefDirUri,propathRelativeFile + ".xref")
				}
				this.files.push(fileObj)
				this.filemap.set(relativeFile,fileObj)
				return fileObj
			}
		}
		return undefined
	}

	async search(file: string | Uri) {
		if (file instanceof Uri) {
			return this.searchUri(file)
		}
		let relativeFile = file
		if (!relativeFile.endsWith(".cls") && !relativeFile.endsWith(".p") && !relativeFile.endsWith(".w") && !relativeFile.endsWith(".i")) {
			relativeFile = relativeFile.replace(/\./g,'/') + ".cls"
		}

		const got = this.filemap.get(relativeFile)
		if (got) {
			return got
		}

		for (const e of this.propath.entry) {
			const fileInPropathUri = Uri.joinPath(e.uri, relativeFile)
			const exists = await workspace.fs.stat(fileInPropathUri).then((stat) => { return true }, (err) => { return false })


			if (exists) {
				let propathRelativeFile = fileInPropathUri.fsPath.replace(e.uri.fsPath,'')
				if (propathRelativeFile != fileInPropathUri.fsPath) {
					propathRelativeFile = propathRelativeFile.substring(1)
				}
				const fileObj: IABLFile = {
					uri: fileInPropathUri,
					file: file,
					relativeFile: relativeFile,
					propathEntry: e,
					propathRelativeFile: propathRelativeFile,
					xrefUri: Uri.joinPath(e.xrefDirUri,propathRelativeFile + ".xref")
				}
				this.files.push(fileObj)
				this.filemap.set(relativeFile,fileObj)
				return fileObj
			}
		}
		if (!file) {
			console.error("(search) cannot find '" + file + "' in propath")
			throw new Error("(search) cannot find '" + file + "' in propath")
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
