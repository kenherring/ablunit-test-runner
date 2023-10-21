import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'
import { IProjectJson, readOpenEdgeProjectJson } from './projectSchema';
import { PropathParser } from "./ABLPropath"

export class ABLUnitConfig  {
	workspaceDir: Uri

	constructor(workspaceDir: Uri) {
		this.workspaceDir = workspaceDir
	}

	workspaceUri(): Uri {
		// TODO - handle multiple workspace folders
		if (workspace.workspaceFolders == undefined) {
			throw new Error("No workspace folders defined")
		}
		return workspace.workspaceFolders[0].uri
	}

	async getTempDirUri (storageUri: Uri) {
		const tempDir: string = workspace.getConfiguration('ablunit').get('tempDir', '')
		if (!tempDir || tempDir === '') {
			throw new Error("no tempDir configured")
		}

		let uri: Uri
		if (RegExp(/^[a-zA-Z]:/).exec(tempDir)) {
			uri = Uri.file(tempDir)
			//TODO test unix paths
		} else {
			uri = Uri.joinPath(this.workspaceUri(), tempDir)
		}

		return workspace.fs.stat(uri).then((stat) => {
			return uri
		}, (err) => {
			return workspace.fs.createDirectory(uri).then(() => {
				return uri
			}, (err) => {
				throw err
			})
		})
	}

	async createTempDirUri (uri: Uri) {
		return workspace.fs.stat(uri).then((stat) => {
			return uri
		}, (err) => {
			return workspace.fs.createDirectory(uri).then(() => {
				return uri
			}, (err) => {
				console.log("createTempDir error: " + err)
				throw err
			})
		})
	}

	async getProgressIni (tempDirUri: Uri) {
		const workspaceUri = this.workspaceUri()
		if (!workspaceUri) {
			throw (new Error("no workspace directory opened"))
		}

		const uriList: Uri[] = []

		//first, check if the progressIni config is set for the workspace
		const configIni = workspace.getConfiguration('ablunit').get('progressIni', '')
		if (configIni != '') {
			const uri1 = Uri.joinPath(workspaceUri, configIni)
			if(uri1 && await workspace.fs.stat(uri1)) {
				return uri1
			}
		}

		//second, check if there is a progress ini in the root of the repo
		const uri2 = Uri.joinPath(workspaceUri, 'progress.ini')
		if(uri2) {
			const stat2 = await workspace.fs.stat(uri2).then((stat) => {
				if(stat) { return true }}, (err) => {
				return false
			})
			if (stat2) {
				return uri2
			}
		}

		//third, check if the workspace has a temp directory configured
		const uri3 = Uri.joinPath(tempDirUri, 'progress.ini')
		if(uri3) {
			//Use this whether or not it exists yet
			return uri3
		}

		throw (new Error("cannot resolve progress.ini path"))
	}

	async createProgressIni(progressIni: Uri, propath: string) {
		const iniData = ["[WinChar Startup]", "PROPATH=" + propath]
		const iniBytes = Uint8Array.from(Buffer.from(iniData.join("\n")))

		console.log("creating profile.ini")
		return workspace.fs.writeFile(progressIni, iniBytes)
	}

	async createAblunitJson(uri: Uri, opt: any) {
		return workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(opt, null, 2)))).then(() => {
			console.log("created ablunit.json")
		}, (err) => {
			console.error("error creating ablunit.json: " + err)
			throw err
		})
	}

	resultsUri (tempDirUri: Uri) {
		let resultsFile = workspace.getConfiguration('ablunit').get('resultsPath', '')
		if(!resultsFile) {
			throw (new Error("no workspace directory opened"))
		}
		if(resultsFile == "") {
			resultsFile = "results.xml"
		}

		if (RegExp(/^[a-zA-Z]:/).exec(resultsFile)) {
			return Uri.parse(resultsFile)
		}
		return Uri.joinPath(tempDirUri, resultsFile)
	}

	getProfileOutput(tempDirUri: Uri) {
		return Uri.joinPath(tempDirUri,workspace.getConfiguration('ablunit').get('profileOutputPath', ''))
	}

	async createProfileOptions (profUri: Uri, profOut: Uri, listingDir: Uri) {
		const profFile = 'profile.options'
		const profOpts = [	"-coverage",
							"-description \"ABLUnit Run from VSCode\"",
							"-filename " + profOut.fsPath,
							"-listings " + listingDir.fsPath ]
		console.log("creating profile.options")
		return workspace.fs.writeFile(profUri, Uint8Array.from(Buffer.from(profOpts.join("\n"))))
	}

	async createListingDir(uri: Uri) {
		return workspace.fs.stat(uri).then((stat) => {}, (err) => {
			return workspace.fs.createDirectory(uri)
		})
	}

	getCommandSetting(): string {
		return workspace.getConfiguration('ablunit').get('tests.command', '').trim()
	}

	async readPropathFromJson() {
		const parser: PropathParser = new PropathParser(this.workspaceUri())

		const dflt: IProjectJson = { propathEntry: [{
			path: '.',
			type: 'source',
			buildDir: '.',
			xrefDir: '.'
		}]}

		await readOpenEdgeProjectJson().then((propath) => {
			if (propath) {
				parser.setPropath(propath)
			} else {
				parser.setPropath(dflt)
			}
			return parser
		}, (err) => {
			console.log("error reading openedge-project.json: " + err)
			parser.setPropath(dflt)
			return parser
		})

		outputChannel.appendLine("propath='" + parser.toString() + "'")
		return parser
	}
}
