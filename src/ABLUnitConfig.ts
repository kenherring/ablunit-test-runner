import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'
import { ABLPromsgs } from './ABLpromsgs';

const doesFileExistSync = async (uri: Uri) => {
	try {
		const stat = await workspace.fs.stat(uri);
		if(stat) {
			return true
		}
		return false
	} catch (e) {
		return false
	}
}

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
			if (await doesFileExistSync(uri)) {
				outputChannel.appendLine("tempDir='" + uri.fsPath + "'")
				this.tempDirUri = uri
				return
			} else {
				console.log("attempting to create tempDir '" + uri.fsPath + "'")
				await workspace.fs.createDirectory(uri)
				if (await doesFileExistSync(uri)) {
					outputChannel.appendLine("tempDir='" + uri.fsPath + "'")
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
		console.log("getProgressIni workspaceUri=" + workspaceUri)

		const uriList: Uri[] = []

		//first, check if the progressIni config is set for the workspace
		const configIni = workspace.getConfiguration('ablunit').get('progressIni', '')
		if (configIni != '') {
			const uri1 = Uri.joinPath(workspaceUri, configIni)
			if(uri1 && await doesFileExistSync(uri1)) {
				return uri1
			}
		}

		//second, check if there is a progress ini in the root of the repo
		const uri2 = Uri.joinPath(workspaceUri, 'progress.ini')
		if(uri2 && await doesFileExistSync(uri2)) {
			return uri2
		}

		//third, check if the workspace has a temp directory configured
		const uri3 = Uri.joinPath(this.tempDirUri!, 'progress.ini')
		if(uri3) {
			//Use this whether or not it exists yet
			return uri3
		}

		throw (new Error("cannot find a suitable progress.ini or temp directory"))
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

	notificationsEnabled(): boolean {
		return workspace.getConfiguration('ablunit').get('notificationsEnabled', true)
	}

	getCommandSetting(): string {
		return workspace.getConfiguration('ablunit').get('tests.command', '').trim()
	}
}
