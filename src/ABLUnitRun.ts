import { TestItem, TestRun, workspace } from "vscode"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { ABLResults } from "./ABLResults"
import { logToChannel } from './ABLUnitCommon'
import { IABLUnitConfig } from "./ABLUnitConfigWriter"

//TODO remove this
import * as cp from "child_process";

export const ablunitRun = async(ablunitConfig: IABLUnitConfig, options: TestRun, res: ABLResults) => {
	const start = Date.now()

	res.createAblunitJson()

	const getCommand = () => {
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

		const cmdSanitized: string[] = []

		ablunitConfig.params.split(' ').forEach(element => {
			cmd.push(element)
		});

		cmd.push("-param", '"CFG=' + ablunitConfig.config_uri.fsPath + '"')
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

		ablunitConfig.tests.commandArr = cmdSanitized
		logToChannel("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const runCommand = () => {
		const args = getCommand()
		logToChannel("ShellExecution Started - dir='" + ablunitConfig.workspaceUri.fsPath + "'")

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
				logToChannel("ShellExecution Completed - duration: " + duration)
				resolve(stdout)
			})
		})
	}

	return runCommand().then(() => {
		return res.parseOutput(options).then();
	})
}
