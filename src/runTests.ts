
import * as vscode from 'vscode'

exports.runTests = void 0;

export const runTests = (config: string, storageUri: vscode.Uri) => {
	console.log(1)
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri
	console.log("2: " +  JSON.stringify(vscode.workspace.workspaceFolders![0].uri))
	
	const runCommand = (testConfig: string, options: vscode.TestRun, storageUri: vscode.Uri) => {
		console.log("3: runCommand")
		if (!workspaceUri) {
			throw ("no workspace directory opened")
		}
		const cmd: string = buildCommand(testConfig, workspaceUri, storageUri)
		const notificationsEnabled = vscode.workspace.getConfiguration('ablunit').get('notificationsEnabled', true)

		if (notificationsEnabled) {
			vscode.window.showInformationMessage("running ablunit tests");
		}
		// vscode.tasks.executeTask(
		// 	new vscode.Task(
		// 		{ type: 'process' },
		// 		vscode.TaskScope.Workspace,
		// 		"ablunit run tests",
		// 		"ablunit-test-provider",
		// 		new vscode.ShellExecution(cmd, { cwd: workspaceUri.fsPath })));
		// if (notificationsEnabled) {
		// 	vscode.window.showInformationMessage("ablunit tests complete");
		// }

		const args=cmd.split(" ")
		console.log ("args=" + args)
		vscode.ProcessExecution.call(this, cmd, args)
		console.log("ProcessExecution complete")
	}

	const runCommandSimple = (testConfig: string, storageUri: vscode.Uri) => {
		console.log("3: runCommand workspaceUri=" + workspaceUri)
		if (!workspaceUri) {
			console.log("4: workspaceUri=" + workspaceUri)
		}
		console.log(5)
		const cmd: string = buildCommand(testConfig, workspaceUri, storageUri)
		const notificationsEnabled = vscode.workspace.getConfiguration('ablunit').get('notificationsEnabled', true)

		if (notificationsEnabled) {
			vscode.window.showInformationMessage("running ablunit tests");
		}

		// vscode.tasks.executeTask(
		// 	new vscode.Task(
		// 		{ type: 'process' },
		// 		vscode.TaskScope.Workspace,
		// 		"ablunit run tests",
		// 		"ablunit-test-provider",
		// 		new vscode.ShellExecution(cmd, { cwd: workspaceUri.fsPath })));
		// if (notificationsEnabled) {
		// 	vscode.window.showInformationMessage("ablunit tests complete");
		// }

		const args=cmd.split(" ")
		console.log ("args=" + args)
		vscode.ProcessExecution.call(this, cmd, args)
		console.log("ProcessExecution complete")
	}

	runCommandSimple(config, storageUri)
}

function buildCommand (testConfig: string, workspaceUri: vscode.Uri, storageUri: vscode.Uri): string {
	if(!storageUri) {
		throw ("temp directory not set")
	}
	vscode.workspace.fs.createDirectory(storageUri)
	
	var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
	if (! cmd) {
		cmd = '_progres -b -p ABLUnitCore.p ${progressIni} -param "${itemPath} CFG=ablunit.json"';
	}
	
	console.log("process.platform=" + process.platform)
	if (process.platform === 'win32') {
		const progressIni = getProgressIni(workspaceUri, storageUri)
		if (!progressIni) { throw ("cannot find progress.ini or suitable location to write one") }
		const progressIniStat = vscode.workspace.fs.stat(progressIni)
		if(! progressIniStat) {
			console.log("progress.ini does not exist - creating")
			createProgressIni(progressIni)
		}
		cmd = cmd.replace("${itemPath}",testConfig).replace("${progressIni}","-basekey INI -ininame '" + progressIni.fsPath + "'");
	}

	console.log("cmd=" + cmd)
	return cmd
}

function getProgressIni (workspaceUri: vscode.Uri, storageUri: vscode.Uri): vscode.Uri {
	if (!workspaceUri) {
		throw ("no workspace directory opened")
	}
	console.log("getProgressIni workspaceUri=" + workspaceUri)

	//first, check if the progressIni config is set for the workspace
	const configIni = vscode.workspace.getConfiguration('ablunit').get('progressIni', '')
	if (configIni != '') {
		const uri1 = vscode.Uri.joinPath(workspaceUri, configIni)
		console.log("uri1=" + uri1)
		if(uri1){
			return uri1
		}
	}

	//second, check if there is a progress ini in the root of the repo
	console.log("workspaceUri=" + workspaceUri)
	if(workspaceUri) {
		const uri2 = vscode.Uri.joinPath(workspaceUri, 'progress.ini')
		console.log("uri2=" + uri2)
		if (uri2) {
			return uri2
		}
	}

	//third, check if the workspace has a temp directory configured
	const uri3 = vscode.Uri.parse(vscode.workspace.getConfiguration('ablunit').get('tempDir', ''))
	console.log("uri3=" + uri3)
	if (uri3) {
		return uri3
	}

	//fourth, and lastly, use the extension temp directory
	if(storageUri) {
		const stat1 = vscode.workspace.fs.stat(storageUri)
		console.log("stat1=" + stat1)
		if(!stat1) {
			vscode.workspace.fs.createDirectory(storageUri)
		}
		const stat2 = vscode.workspace.fs.stat(storageUri)
		console.log("stat2=" + stat2)

		const uri4 = vscode.Uri.joinPath(storageUri, 'progress.ini')
		console.log("uri4=" + uri4)
		if(uri4) {
			return uri4
		}
	}
	throw ("cannot find a suitable progress.ini or temp directory")
}

function createProgressIni (progressIni: vscode.Uri) {
	const iniData = [ "[WinChar Startup]", "PROPATH=." ]
	vscode.workspace.fs.writeFile(progressIni, Uint8Array.from(Buffer.from(iniData.join("\n"))))
}