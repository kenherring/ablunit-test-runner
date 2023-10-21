import { TestItem, TestRun, workspace } from "vscode"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { ABLResults } from "./ABLResults"
import { outputChannel } from './ABLUnitCommon'

//TODO remove this
import * as cp from "child_process";

export const ablunitRun = async(item: TestItem, options: TestRun, data: ABLUnitTestData, res: ABLResults) => {
	const start = Date.now()

	// let itemPath = workspace.asRelativePath(item.uri!.fsPath)
	let itemPath = workspace.asRelativePath(item.uri!.fsPath)
	if (data instanceof ABLTestProcedure || data instanceof ABLTestMethod) {
		itemPath = itemPath + "#" + item.label
	}

	const getCommand = (itemPath: string) => {
		if (!res.runConfig.tempDirUri) {
			throw (new Error("temp directory not set"))
		}

		const cmd = ['_progres', '-b', '-p', 'ABLUnitCore.p']

		if (process.platform === 'win32') {
			cmd.push('-basekey', 'INI', '-ininame', res.runConfig.progressIni!.fsPath)
		}

		cmd.push('-T', res.runConfig.tempDirUri.fsPath)
		cmd.push('-profile', res.runConfig.profileOptions!.fsPath)
		// cmd.push('-param', "'CFG=" + res.runConfig.ablunitJson!.fsPath + "'")
		// cmd.push("-param", '"' + itemPath + ' -outputLocation ' + workspace.asRelativePath(res.runConfig.tempDirUri) + ' -format xml"')
		cmd.push("-param", '"' + itemPath + ' -outputLocation ' + workspace.asRelativePath(res.runConfig.tempDirUri) + '"')
		const cmdSanitized: string[] = []
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

		res.runConfig.cmd = cmdSanitized
		outputChannel.appendLine("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const runCommand = () => {
		const args = getCommand(itemPath)
		console.log("ShellExecution Started - dir='" + res.runConfig.workspaceDir.fsPath + "'")
		outputChannel.appendLine("ShellExecution Started - dir='" + res.runConfig.workspaceDir.fsPath + "'")

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {

			console.log("COMMAND=" + cmd + " " + args.join(' '))
			cp.exec(cmd + ' ' + args.join(' '), { cwd: res.runConfig.workspaceDir.fsPath }, (err: any, stdout: any, stderr: any) => {
				const duration = Date.now() - start
				if (err) {
					console.error("cp.exec error:" + err)
					throw err
				}
				if (stderr) {
					console.error(stderr)
					options.appendOutput("stderr:" + stderr)
					reject(stderr)
				}
				options.appendOutput(stdout)

				console.log("ShellExecution Completed - duration: " + duration)
				outputChannel.appendLine("ShellExecution Completed - duration: " + duration)
				resolve(stdout)
			})
		})
	}

	await res.createAblunitJson(itemPath)
	return runCommand().then(() => {
		return res.parseOutput(item, options).then();
	})
}
