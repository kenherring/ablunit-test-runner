import { Uri, workspace } from 'vscode'
import { outputChannel } from './ABLUnitCommon'

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

	constructor(sUri: Uri) {
		this.storageUri = sUri
	}

	workspaceUri() {
		if (workspace.workspaceFolders == undefined) {
			throw "No workspace folders defined"
		}
		return workspace.workspaceFolders[0].uri
		// TODO - handle multiple workspace folders
	}

	static workspaceUri(): Uri {
		if (workspace.workspaceFolders == undefined) {
			throw "No workspace folders defined"
		}
		return workspace.workspaceFolders[0].uri
		// TODO - handle multiple workspace folders
	}

	setTempDirUri = async () => {
		console.log("tempDirUri 1")
		const uriList = [this.storageUri]
		let tempDir = workspace.getConfiguration('ablunit').get('tempDir', '')

		if (tempDir) {
			try {
				// if the dir maps to a Uri that is valid, put it at the front of the list
				if (tempDir.match(/^[a-zA-Z]:/)) {
					uriList.unshift(Uri.parse(tempDir))
					//TODO test unix paths
				} else {
					uriList.unshift(Uri.joinPath(ABLUnitConfig.workspaceUri(), tempDir))
				}
			} catch (err) {
				console.error(err)
			}
		}

		for (const uri of uriList) {
			console.log("checking if uri exists: " + uri)
			if (await doesFileExistSync(uri)) {
				console.log("tempDirUri 2 - return " + uri)
				outputChannel.appendLine("tempDir='" + uri.fsPath + "'")
				this.tempDirUri = uri
				return
			} else {
				console.log("attempting to create tempDir '" + uri.fsPath + "'")
				await workspace.fs.createDirectory(uri)
				if (await doesFileExistSync(uri)) {
					outputChannel.appendLine("tempDir='" + uri.fsPath + "'")
					console.log("tempDirUri 3 - return " + uri)
					this.tempDirUri = uri
					return
				}
			}
		}
		throw("uncaught error - cannot resolve tempDir")
	}

	async getProgressIni () {
		const workspaceUri = ABLUnitConfig.workspaceUri()
		if (!workspaceUri) {
			throw ("no workspace directory opened")
		}
		console.log("getProgressIni workspaceUri=" + workspaceUri)

		const uriList: Uri[] = []

		//first, check if the progressIni config is set for the workspace
		const configIni = workspace.getConfiguration('ablunit').get('progressIni', '')
		if (configIni != '') {
			const uri1 = Uri.joinPath(workspaceUri, configIni)
			console.log("uri1=" + uri1)
			if(uri1 && await doesFileExistSync(uri1)) {
				return uri1
			}
		}

		//second, check if there is a progress ini in the root of the repo
		console.log("workspaceUri=" + workspaceUri)
		const uri2 = Uri.joinPath(workspaceUri, 'progress.ini')
		console.log("uri2=" + uri2)
		if(uri2 && await doesFileExistSync(uri2)) {
			return uri2
		}

		//third, check if the workspace has a temp directory configured
		const uri3 = Uri.joinPath(this.tempDirUri!, 'progress.ini')
		console.log("uri3=" + uri3)
		if(uri3) {
			//Use this whether or not it exists yet
			return uri3
		}

		throw ("cannot find a suitable progress.ini or temp directory")
	}

	resultsUri () {
		var resultsFile = workspace.getConfiguration('ablunit').get('resultsPath', '')
		if(!resultsFile) {
			throw ("no workspace directory opened")
		}
		if(resultsFile == "") {
			resultsFile = "results.xml"
		}

		if (resultsFile.match(/^[a-zA-Z]:/)) {
			return Uri.parse(resultsFile)
		}
		return Uri.joinPath(this.tempDirUri!, resultsFile)
	}


	getProfileOutputUri () {
		const profileOutputPath = workspace.getConfiguration('ablunit').get('profileOutputPath', '')
		if (profileOutputPath.match(/^[a-zA-Z]:/)) {
			return Uri.parse(profileOutputPath)
		} else {
			return Uri.joinPath(this.tempDirUri!, profileOutputPath)
		}
	}

	notificationsEnabled(): boolean {
		return workspace.getConfiguration('ablunit').get('notificationsEnabled', true)
	}
}
