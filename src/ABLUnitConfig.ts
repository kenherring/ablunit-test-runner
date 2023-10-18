import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'
import { ABLPromsgs } from './ABLpromsgs';
import { IProjectJson, IPropathEntry, readOpenEdgeProjectJson } from './projectSchema';
import { PropathParser } from "./ABLPropath"

export class ABLUnitConfig  {

	storageUri: Uri
	tempDirUri: Uri | undefined
	promsgs: ABLPromsgs | undefined
	propath: PropathParser

	constructor(sUri: Uri, wsFolder: Uri) {
		this.storageUri = sUri
		this.propath = new PropathParser(wsFolder)
	}

	async start () {
		await this.setTempDirUri().then(() => {
			this.promsgs = new ABLPromsgs(this.tempDirUri!)
		})
		await this.getPropath().then
	}

	workspaceUri(): Uri {
		if (workspace.workspaceFolders == undefined) {
			throw new Error("No workspace folders defined")
		}
		return workspace.workspaceFolders[0].uri
		// TODO - handle multiple workspace folders
	}

	setTempDirUri = async () => {
		const uriList = [this.storageUri]
		const tempDir: string = workspace.getConfiguration('ablunit').get('tempDir', '')

		if (tempDir) {
			try {
				// if the dir maps to a Uri that is valid, put it at the front of the list
				if (RegExp(/^[a-zA-Z]:/).exec(tempDir)) {
					uriList.unshift(Uri.parse(tempDir))
					//TODO test unix paths
				} else {
					uriList.unshift(Uri.joinPath(this.workspaceUri(), tempDir))
				}
			} catch (err) {
				console.error(err)
			}
		}

		for (const uri of uriList) {
			if (await workspace.fs.stat(uri).then((stat) => { return true }, (err) => { return false })) {
				outputChannel.appendLine("tempDir='" + uri.fsPath + "'")
				this.tempDirUri = uri
				return
			} else {
				await workspace.fs.createDirectory(uri).then(() => {
					console.log("created tempDir(1)='" + uri.fsPath + "' successfully")
				}, (err) => {
					console.error("failed to create " + uri.fsPath + " - " + err)
				})
				if (await workspace.fs.stat(uri).then((stat) => { return true }, (err) => { return false })) {
					outputChannel.appendLine("created tempDir(2)='" + uri.fsPath + "'")
					this.tempDirUri = uri
					return
				}
			}
		}
		throw(new Error("uncaught error - cannot resolve tempDir"))
	}

	async getProgressIni () {
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
		const uri3 = Uri.joinPath(this.tempDirUri!, 'progress.ini')
		if(uri3) {
			//Use this whether or not it exists yet
			return uri3
		}

		throw (new Error("cannot resolve progress.ini path"))
	}

	async createProgressIni(progressIni: Uri, propath: string) {
		const iniData = ["[WinChar Startup]", "PROPATH=" + propath]
		const iniBytes = Uint8Array.from(Buffer.from(iniData.join("\n")))

		return workspace.fs.writeFile(progressIni, iniBytes).then(() => {
			return true
		}, (err) => {
			throw (new Error("error writing progress.ini: " + err))
		})
	}

	async getAblunitJson() {
		return Uri.joinPath(this.tempDirUri!, 'ablunit.json')
	}

	async resultsUri () {
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
		return Uri.joinPath(this.tempDirUri!, resultsFile)
	}

	getProfileOutput() {
		return Uri.joinPath(this.tempDirUri!,workspace.getConfiguration('ablunit').get('profileOutputPath', ''))
	}

	async createProfileOptions (profOut: Uri, listingDir: Uri) {
		const profFile = 'profile.options'

		let profUri: Uri
		if (RegExp(/^[a-zA-Z]:/).exec(profFile)) {
			profUri = Uri.parse(profFile)
		} else {
			profUri = Uri.joinPath(this.tempDirUri!, profFile)
		}
		const profOpts = [	"-coverage",
							"-description \"ABLUnit\"",
							"-filename " + profOut.fsPath,
							"-listings " + listingDir.fsPath ]
		await workspace.fs.writeFile(profUri, Uint8Array.from(Buffer.from(profOpts.join("\n")))).then()
		return profUri
	}

	async listingDirUri() {
		const uri = Uri.joinPath(this.tempDirUri!, 'listings')
		return await workspace.fs.stat(uri).then((stat) => {
			return uri
		}, (err) => {
			return workspace.fs.createDirectory(uri).then(() => {
				return uri
			}, (err) => {
				throw new Error("failed to create directory (2) " + uri + " with error: " + err)
			});
		})
	}

	getCommandSetting(): string {
		return workspace.getConfiguration('ablunit').get('tests.command', '').trim()
	}

	async importOpenedgeProjectJson_str() {
		const pp = await readOpenEdgeProjectJson().then((oeProjConfig) => {
			if (!oeProjConfig) {
				return
			}
			const propath: string[] = []
			const buildDir: string[] = []
			for (const e in oeProjConfig.propathEntry) {
				propath.push(oeProjConfig.propathEntry[e].path)
			}
			return propath
		})
		return (pp)
	}

	async getPropath() {
		await readOpenEdgeProjectJson().then((propath) => {
			if (propath) {
				this.propath.setPropath(propath)
				return
			} else {
				const dflt1: IPropathEntry = {
					path: '.',
					type: 'source',
					buildDir: '.'
				}
				const dflt2: IProjectJson = { propathEntry: []}
				dflt2.propathEntry.push(dflt1)
				this.propath.setPropath(dflt2)
				return
			}
		}, (err) => {
			const dflt1: IPropathEntry = {
				path: '.',
				type: 'source',
				buildDir: '.'
			}
			const dflt2: IProjectJson = { propathEntry: []}
			dflt2.propathEntry.push(dflt1)
			this.propath.setPropath(dflt2)
			return
		})

		outputChannel.appendLine("propath='" + this.propath.toString())
		return this.propath.toString()
	}

	getBuildDir(): string {
		return workspace.getConfiguration('ablunit').get('buildDir', '')
	}

}
