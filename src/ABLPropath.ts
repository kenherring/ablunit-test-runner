import { Uri, workspace } from 'vscode'
import { ABLUnitConfig } from './ABLUnitConfig'
import path = require('path')

interface PropathEntry {
	uri: Uri
	relativePath?: string
	// files: Uri[]
}

interface ABLFile {
	uri: Uri,
	relativePath?: string,
	propathEntry?: PropathEntry,
	propathRelativePath?: string
}

export class PropathParser {
	cfg: ABLUnitConfig
	propath: PropathEntry[] = []
	filemap: Map<string, ABLFile> = new Map()
	files: ABLFile[] = []
	// oeUris: Uri[] = []
	// findFilesPromise

	constructor(cfg: ABLUnitConfig) {
		this.cfg = cfg
		// console.log("CONSTRUCTOR 1")
		// this.findFilesPromise = workspace.findFiles('**/*.{cls,p,w,i}', "**/.builder/**").then((uris) => {
		// 	console.log("CONSTRUCTOR 2")
		// 	this.oeUris = uris
		// 	console.log("CONSTRUCTOR 3")
		// })
		// console.log("CONSTRUCTOR 4")
	}

	// setPropath(entries: string | string[]) {
	async setPropath(list: string) {
		// await this.findFilesPromise

		const entries = list.split(',')
		console.log("////////////// setPropath begin //////////////")
		for (const entry of entries) {
			let uri: Uri
			if(RegExp(/^[a-zA-Z]:/).exec(entry)) {
				uri = Uri.file(entry)
			} else {
				uri = Uri.joinPath(this.cfg.workspaceUri(),entry)
			}


			let rel: string | undefined
			rel = workspace.asRelativePath(uri)
			if(uri.fsPath === rel) {
				rel = undefined
			}

			const e: PropathEntry = {
				uri: uri,
				relativePath: rel,
				// files: []
			}
			// e.files = this.oeUris.filter((oeUri) => { return oeUri.fsPath.startsWith(uri.fsPath) })
			this.propath.push(e)
		}
		console.log("////////////// setPropath end //////////////")
	}

	getPropath(): PropathEntry[] {
		return this.propath
	}

	async getPropathEntryFromFileUri(uri: Uri) {
		return this.propath.find((entry) => {
			if(entry.uri.fsPath === uri.fsPath) {
				return entry
			} else {
				throw (new Error(`Could not find propath entry for ${uri.fsPath}`))
			}
		})
	}

	async setSourcePropathInfo(source: string) {
		if(source.startsWith('OpenEdge.') || source === 'ABLUnitCore.p') { return }
		if (this.filemap.get(source)) { return }

		const proStr: string[] = []
		for (const entry of this.propath) {
			if (entry.relativePath) {
				proStr.push(entry.relativePath + "/" + source)
			}
		}

		const uri = await workspace.findFiles(`{${proStr.join(',')}}`, "**/.builder/**").then((uris) => {
			if (uris.length === 0) {
				throw (new Error(`Could not find file for ${source}`))
			} else if (uris.length > 1) {
				throw (new Error(`Found multiple files for ${source}`))
			} else {
				return uris[0]
			}
		})

		const file: ABLFile = {
			uri: uri,
			relativePath: workspace.asRelativePath(uri),
			propathRelativePath: source
		}
		this.files.push(file)
		this.filemap.set(source, file)
	}

	async setFilePropathInfo(uri: Uri) {
		if (this.filemap.get(uri.fsPath)) { return }

		const file: ABLFile = {
			uri: uri,
			relativePath: workspace.asRelativePath(uri)
		}
		this.files.push(file) //TODO - do the assigns after still update the files array?
		this.getPropathEntryFromFileUri(uri).then((entry) => {
			file.propathEntry = entry
		})
		file.propathRelativePath = uri.fsPath.replace(file.propathEntry!.uri.fsPath,'')
		this.filemap.set(uri.fsPath, file)
	}

	getFileByUri(uri: Uri): ABLFile {
		return this.files.find((file) => {
			if(file.uri.fsPath === uri.fsPath) {
				return file
			} else {
				throw (new Error(`Could not find file for ${uri.fsPath}`))
			}
		})!
	}

	searchPropath(filepath: string) {
		const file = this.filemap.get(filepath)
		if (file) {
			return file.uri
		}

		const filename = path.basename(filepath)
		const dirname = path.dirname(filepath)

		const searchStr = `**/${filename}`
		const searchDir = dirname

		return workspace.findFiles(searchStr, searchDir).then((uris) => {
			if (uris.length === 0) {
				return undefined
			} else if (uris.length > 1) {
				throw (new Error(`Found multiple files for ${filepath}`))
			} else {
				return uris[0]
			}
		}, (err) => {
			throw (new Error(`Error searching propath for ${filepath}`))
		})
	}


}
