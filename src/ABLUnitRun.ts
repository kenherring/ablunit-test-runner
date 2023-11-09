import { TestItem, TestRun, workspace } from "vscode"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { ABLResults } from "./ABLResults"
import { outputChannel } from './ABLUnitCommon'
import { IABLUnitConfig } from "./ABLUnitConfigWriter"

//TODO remove this
import * as cp from "child_process";

export const ablunitRun = async(item: TestItem, ablunitConfig: IABLUnitConfig, options: TestRun, data: ABLUnitTestData, res: ABLResults) => {
	const start = Date.now()

	// let itemPath = workspace.asRelativePath(item.uri!.fsPath)
	const fileinfo = await res.propath?.search(item.uri!)
	let itemPath: string = fileinfo?.propathRelativeFile ?? item.uri!.fsPath

	if (data instanceof ABLTestProcedure || data instanceof ABLTestMethod) {
		itemPath = itemPath + "#" + item.label
	}

	const getCommand = (itemPath: string) => {
		if (!ablunitConfig.tempDirUri) {
			throw (new Error("temp directory not set"))
		}

		const cmd = [res.dlc + '/bin/_progres', '-b', '-p', 'ABLUnitCore.p']
		if (process.platform === 'win32') {
			cmd.push('-basekey', 'INI', '-ininame', ablunitConfig.progressIniUri.fsPath)
		}
		cmd.push('-T', workspace.asRelativePath(ablunitConfig.tempDirUri))

		if (ablunitConfig.profilerOptions.enabled) {
			cmd.push('-profile', workspace.asRelativePath(ablunitConfig.profilerOptions.optionsUri))
		}
		// cmd.push('-param', "'CFG=" + res.runConfig.ablunitJson!.fsPath + "'")
		// cmd.push("-param", '"' + itemPath + ' -outputLocation ' + workspace.asRelativePath(res.runConfig.tempDirUri) + ' -format xml"')
		cmd.push("-param", '"' + itemPath + ' -outputLocation ' + workspace.asRelativePath(ablunitConfig.tempDirUri) + '"')
		const cmdSanitized: string[] = []
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

		ablunitConfig.tests.commandArr = cmdSanitized
		outputChannel.appendLine("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const runCommand = () => {
		const args = getCommand(itemPath)
		console.log("ShellExecution Started - dir='" + ablunitConfig.workspaceUri.fsPath + "'")
		outputChannel.appendLine("ShellExecution Started - dir='" + ablunitConfig.workspaceUri.fsPath + "'")

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {

			console.log("COMMAND=" + cmd + " " + args.join(' '))
			res.setStatus("running '" + cmd + "' command")
			cp.exec(cmd + ' ' + args.join(' '), { cwd: ablunitConfig.workspaceUri.fsPath }, (err: any, stdout: any, stderr: any) => {
				const duration = Date.now() - start
				if (err) {
					console.error("cp.exec error=" + err.toString())
					console.error("cp.exec stdout=" + stdout)
					console.error("cp.exec stderr=" + stderr)
					options.appendOutput("err=" + err)
					options.appendOutput("stdout=" + stdout)
					options.appendOutput("stderr=" + stderr)
					reject(err)
				}
				if (stderr) {
					console.error("cp.exec stderr=" + stderr)
					options.appendOutput(stderr)
					reject(stderr)
				}
				options.appendOutput("stdout:" + stdout + "\r\n")
				console.log("ShellExecution Completed - duration: " + duration)
				outputChannel.appendLine("ShellExecution Completed - duration: " + duration)
				resolve(stdout)
			})
		})
	}

	return runCommand().then(() => {
		options.appendOutput("parsing results\r\n")
		return res.parseOutput(item, options).then();
	})
}
