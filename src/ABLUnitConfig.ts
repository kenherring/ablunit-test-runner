import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'
import { ABLPromsgs } from './ABLpromsgs';

export class ABLUnitConfig  {

	storageUri: Uri
	tempDirUri: Uri | undefined
	promsgs: ABLPromsgs | undefined

	constructor(sUri: Uri) {
		this.storageUri = sUri
		this.setTempDirUri().then(() => {
			this.promsgs = new ABLPromsgs(this.tempDirUri!)
		})
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
				console.log("attempting to create tempDir '" + uri.fsPath + "'")
				await workspace.fs.createDirectory(uri).then(() => {
					console.log("created tempDir '" + uri.fsPath + "' successfully")
				}, (err) => {
					console.error("failed to create " + uri.fsPath + " - " + err)
				})
				if (await workspace.fs.stat(uri).then((stat) => { return true }, (err) => { return false })) {
					outputChannel.appendLine("created tempDir='" + uri.fsPath + "'")
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

	resultsUri () {
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

	getProfileOutputUri () {
		const profileOutputPath = workspace.getConfiguration('ablunit').get('profileOutputPath', '')
		if (RegExp(/^[a-zA-Z]:/).exec(profileOutputPath)) {
			return Uri.parse(profileOutputPath)
		} else {
			return Uri.joinPath(this.tempDirUri!, profileOutputPath)
		}
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

	notificationsEnabled(): boolean {
		return workspace.getConfiguration('ablunit').get('notificationsEnabled', true)
	}

	getCommandSetting(): string {
		return workspace.getConfiguration('ablunit').get('tests.command', '').trim()
	}

	// importOpenedgeProjectJson(): string {
		// const setting = workspace.getConfiguration('ablunit').get('importOpenedgeProjectJson', '')
		// console.log("setting=" + setting)
		// return workspace.getConfiguration('ablunit').get('importOpenedgeProjectJson', '')
	// }

	getPropath(): string {
		return workspace.getConfiguration('ablunit').get('propath', '.')
		// const env = process.env.PROPATH
		// this.importOpenedgeProjectJson()
		return "src,path"
	}

	getBuildDir(): string {
		return workspace.getConfiguration('ablunit').get('buildDir', '')
	}
}
