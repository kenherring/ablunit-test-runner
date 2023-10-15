
// import * as vscode from 'vscode'
// import { ABLUnitConfig } from './ABLUnitConfig'
// import { stat } from 'fs';

// exports.runTests = void 0


// export const runTests = (cfg: ABLUnitConfig) => {

// 	const workspaceUri = ABLUnitConfig.workspaceUri()
// 	setTempDir()

// 	// const runCommandComplex = (testConfig: string, options: vscode.TestRun) => {
// 	// 	if (workspaceUri) {
// 	// 		throw ("no workspace directory opened")
// 	// 	}
// 	// 	const cmd: string = buildCommand(workspaceUri)
// 	// 	const notificationsEnabled = vscode.workspace.getConfiguration('ablunit').get('notificationsEnabled', true)

// 	// 	if (notificationsEnabled) {
// 	// 		vscode.window.showInformationMessage("running ablunit tests");
// 	// 	}
// 	// 	// vscode.tasks.executeTask(
// 	// 	// 	new vscode.Task(
// 	// 	// 		{ type: 'process' },
// 	// 	// 		vscode.TaskScope.Workspace,
// 	// 	// 		"ablunit run tests",
// 	// 	// 		"ablunit-test-provider",
// 	// 	// 		new vscode.ShellExecution(cmd, { cwd: workspaceUri.fsPath })));
// 	// 	// if (notificationsEnabled) {
// 	// 	// 	vscode.window.showInformationMessage("ablunit tests complete");
// 	// 	// }

// 	// 	const args=cmd.split(" ")
// 	// 	console.log ("args=" + args)
// 	// 	vscode.ProcessExecution.call(this, cmd, args)
// 	// 	console.log("ProcessExecution complete")
// 	// }

// 	const runTestsCommand = (cfg: ABLUnitConfig) => {
// 		if (cfg.notificationsEnabled()) {
// 			vscode.window.showInformationMessage("running ablunit tests");
// 		}

// 		buildCommand(cfg).then(cmd => {
// 			const args=cmd.split(" ")
// 			console.log ("args=" + args)
// 			vscode.ProcessExecution.call(this, cmd, args)
// 			console.log("ProcessExecution complete")
// 		})
// 	}

// 	runTestsCommand(cfg)
// }

// async function buildCommand (cfg: ABLUnitConfig) {
// 	var cmd = vscode.workspace.getConfiguration('ablunit').get('runTestCommand', '').trim();
// 	if (! cmd) {
// 		cmd = '_progres -b -p ABLUnitCore.p ${progressIni} -param "${itemPath} CFG=ablunit.json"';
// 	}

// 	console.log("process.platform=" + process.platform)
// 	cmd = cmd.replace("${itemPath}","config:itemPath")

// 	if (process.platform === 'win32') {
// 		return cfg.getProgressIni().then((progressIni) => {
// 			const progressIniStat = vscode.workspace.fs.stat(progressIni)
// 			if(! progressIniStat) {
// 				console.log("progress.ini does not exist - creating")
// 				createProgressIni(progressIni)
// 			}
// 			cmd = cmd.replace("${progressIni}","-basekey INI -ininame '" + progressIni.fsPath + "'");
// 			console.log("cmd(2)=" + cmd)
// 			return cmd
// 		})
// 		// if (!progressIni) { throw ("cannot find progress.ini or suitable location to write one") }
// 	}

// 	cmd.replace("${progressIni}","")
// 	console.log("cmd(1)=" + cmd)
// 	return cmd

// }

// 	console.log("uri3=" + uri3)
// 	if (uri3) {
// 		uriList.push(uri3)
// 	}


// 	throw ("cannot find a suitable progress.ini or temp directory")
// }

// function createProgressIni (progressIni: vscode.Uri) {
// 	const iniData = [ "[WinChar Startup]", "PROPATH=." ]
// 	vscode.workspace.fs.writeFile(progressIni, Uint8Array.from(Buffer.from(iniData.join("\n"))))
// }
