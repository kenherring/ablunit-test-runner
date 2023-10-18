import { Uri, workspace } from 'vscode'
import path = require('path')
import { IProjectJson } from './projectSchema'

interface PropathEntry {
	uri: Uri
	path: string
	relativePath?: string
	type?: string
	buildDir?: string
	buildDirUri?: Uri
}

interface ABLFile {
	uri: Uri,
	relativePath?: string,
	propathEntry?: PropathEntry,
	propathRelativePath?: string
}

export class PropathParser {
	propath: PropathEntry[] = []
	filemap: Map<string, ABLFile> = new Map()
	files: ABLFile[] = []
	workspaceUri: Uri

	constructor(workspaceUri: Uri) {
		this.workspaceUri = workspaceUri
	}

	async setPropath(propath: IProjectJson) {
		// await this.findFilesPromise
		console.log("////////////// setPropath begin //////////////")
		for (const entry of propath.propathEntry) {
			let uri: Uri
			if(RegExp(/^[a-zA-Z]:/).exec(entry.path)) {
				uri = Uri.file(entry.path)
			} else {
				uri = Uri.joinPath(this.workspaceUri,entry.path)
			}

			console.log("setPropath: " + entry.path + " " + entry.type + " " + entry.buildDir)
			let buildUri: Uri
			if(RegExp(/^[a-zA-Z]:/).exec(entry.buildDir)) {
				buildUri = Uri.file(entry.buildDir)
			} else {
				buildUri = Uri.joinPath(this.workspaceUri,entry.buildDir)
			}

			let rel: string | undefined
			rel = workspace.asRelativePath(uri)
			if(uri.fsPath === rel) {
				rel = undefined
			}

			const e: PropathEntry = {
				path: entry.path,
				type: entry.type,
				buildDir: entry.buildDir,
				uri: uri,
				relativePath: rel,
				buildDirUri: buildUri
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

	getSourcePropathInfo(filepath: string) {
		let propathRelativeFile: string
		if (!filepath.endsWith(".p") && !filepath.endsWith(".cls")) {
			propathRelativeFile = filepath.replace(/\./g,'/') + ".cls"
		} else {
			propathRelativeFile = filepath
		}
		const got = this.filemap.get(propathRelativeFile)
		return this.filemap.get(propathRelativeFile)!.uri.fsPath
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

	buildMap: Map<string, string> = new Map()

	async getBuildDir(filepath: string) {
		return this.buildMap.get(filepath)
	}

	async searchPropath(filepath: string) {

		let propathRelativeFile: string
		if (!filepath.endsWith(".p") && !filepath.endsWith(".cls")) {
			propathRelativeFile = filepath.replace(/\./g,'/') + ".cls"
		} else {
			propathRelativeFile = filepath
		}

		const file = this.filemap.get(propathRelativeFile)
		if (!file) {
			console.error("cannot find '" + propathRelativeFile + "' in propath")
		}

		for (const e of this.propath) {
			const stat = await workspace.fs.stat(e.uri).then()
			if (stat) {
				this.buildMap.set(propathRelativeFile, e.buildDir!)
				return e.uri
			}
		}
		return file!.uri
	}

	toString () {
		const paths: string[] = []
		for (const entry of this.propath) {
			paths.push(entry.path)
		}
		return paths.join(',')
	}

}
