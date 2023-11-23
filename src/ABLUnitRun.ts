import { TestItem, TestRun, workspace } from "vscode"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { ABLResults } from "./ABLResults"
import { logToChannel } from './ABLUnitCommon'
import { IABLUnitConfig } from "./ABLUnitConfigWriter"

//TODO remove this
import * as cp from "child_process";

export const ablunitRun = async(ablunitConfig: IABLUnitConfig, options: TestRun, res: ABLResults) => {
	const start = Date.now()

	await res.createAblunitJson()
	await res.deleteResultsXml()

	const getCommand = () => {
		if (!ablunitConfig.tempDirUri) {
			throw (new Error("temp directory not set"))
		}

		const cmd = [res.dlc + '/bin/_progres', '-b', '-p', 'ABLUnitCore.p']
		if (process.platform === 'win32') {
			cmd.push('-basekey', 'INI', '-ininame', workspace.asRelativePath(ablunitConfig.progressIniUri.fsPath))
		}
		cmd.push('-T', workspace.asRelativePath(ablunitConfig.tempDirUri))

		if (ablunitConfig.profilerOptions.enabled) {
			cmd.push('-profile', workspace.asRelativePath(ablunitConfig.profilerOptions.optionsUri))
		}

		const cmdSanitized: string[] = []

		ablunitConfig.params.split(' ').forEach(element => {
			cmd.push(element)
		});

		cmd.push("-param", '"CFG=' + workspace.asRelativePath(ablunitConfig.config_uri.fsPath) + '"')
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

		ablunitConfig.tests.commandArr = cmdSanitized
		logToChannel("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const runCommand = () => {
		const args = getCommand()
		logToChannel("ABLUnit Command Execution Started - dir='" + ablunitConfig.workspaceUri.fsPath + "'")

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {
			console.log("using command=" + cmd + " " + args.join(' '))
			res.setStatus("running '" + cmd + "' command")

			cp.exec(cmd + ' ' + args.join(' '), { cwd: ablunitConfig.workspaceUri.fsPath }, (err: any, stdout: any, stderr: any) => {
				const duration = Date.now() - start
				if (stdout) {
					logToChannel("_progres stdout=" + stdout)
					options.appendOutput("_progres stdout=" + stdout + "\r\n")
				}
				if (stderr) {
					logToChannel("_progres stderr=" + stderr)
					options.appendOutput("_progres stderr=" + stderr + "\r\n")
					reject(stderr)
				}
				if (err) {
					logToChannel("_progres err=" + err.toString(), 'error')
					options.appendOutput("_progres err=" + err)
					reject(err)
				}
				logToChannel("ABLUnit Command Execution Completed - duration: " + duration)
				resolve("resolve _progres promise")
			})
		})
	}

	return runCommand().then(() => {
		return res.parseOutput(options).then();
	})
}
