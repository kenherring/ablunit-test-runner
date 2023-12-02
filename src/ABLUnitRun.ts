import { TestRun, workspace } from "vscode"
import { ABLResults } from "./ABLResults"
import { logToChannel } from './ABLUnitCommon'

import * as cp from "child_process";

export const ablunitRun = async(options: TestRun, res: ABLResults) => {
	const start = Date.now()

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.configJson)

	const getCommand = () => {
		if (!res.cfg.ablunitConfig.tempDirUri) {
			throw (new Error("temp directory not set"))
		}

		const cmd = [res.dlc + '/bin/_progres', '-b', '-p', 'ABLUnitCore.p']
		if (process.platform === 'win32') {
			cmd.push('-basekey', 'INI', '-ininame', workspace.asRelativePath(res.cfg.ablunitConfig.progressIniUri.fsPath, false))
		} else if (process.platform === 'linux') {
			process.env.PROPATH = res.propath!.toString()
		} else {
			throw new Error("unsupported platform: " + process.platform)
		}
		cmd.push('-T', workspace.asRelativePath(res.cfg.ablunitConfig.tempDirUri, false))

		if (res.cfg.ablunitConfig.profilerOptions.enabled) {
			cmd.push('-profile', workspace.asRelativePath(res.cfg.ablunitConfig.profilerOptions.optionsUri, false))
		}

		const cmdSanitized: string[] = []

		res.cfg.ablunitConfig.params.split(' ').forEach(element => {
			cmd.push(element)
		});

		cmd.push("-param", '"CFG=' + workspace.asRelativePath(res.cfg.ablunitConfig.config_uri.fsPath, false) + '"')
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

		res.cfg.ablunitConfig.tests.commandArr = cmdSanitized
		logToChannel("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const runCommand = () => {
		const args = getCommand()
		logToChannel("ABLUnit Command Execution Started - dir='" + res.cfg.ablunitConfig.workspaceFolder.uri.fsPath + "'")

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {
			res.setStatus("running command")
			console.log("command: " + cmd + " " + args.join(' '))

			cp.exec(cmd + ' ' + args.join(' '), { cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath }, (err: any, stdout: any, stderr: any) => {
				const duration = Date.now() - start
				if (stdout) {
					logToChannel("_progres stdout=" + stdout)
					options.appendOutput("_progres stdout=" + stdout + "\r\n")
				}
				if (stderr) {
					logToChannel("_progres stderr=" + stderr)
					options.appendOutput("_progres stderr=" + stderr + "\r\n")
				}
				if (err) {
					logToChannel("_progres err=" + err.toString(), 'error')
					options.appendOutput("_progres err=" + err)
				}
				if(err || stderr) {
					reject(new Error ("ABLUnit Command Execution Failed - duration: " + duration))
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
