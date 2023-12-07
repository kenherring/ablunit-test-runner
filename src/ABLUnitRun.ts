import { TestRun, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { logToChannel } from './ABLUnitCommon'
import { isRelativePath } from './ABLUnitConfigWriter';
import * as cp from "child_process";

export const ablunitRun = async(options: TestRun, res: ABLResults) => {
	const start = Date.now()

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.configJson)

	const getCommand = () => {
		if (res.cfg.ablunitConfig.tests.command != "") {
			return getCustomCommand()
		}
		return getDefaultCommand()
	}

	const getCustomCommand = () => {
		const cmd = res.cfg.ablunitConfig.tests.command

		const testarr: string[] = []
		for (const test of res.cfg.ablunitConfig.configJson.tests) {
			if (test.test) {
				testarr.push(test.test)
			}
		}
		const testlist = testarr.join(',')

		if (cmd.indexOf('${testlist}') === -1) {
			logToChannel("command does not contain ${testlist}", 'error')
			throw (new Error("command does not contain ${testlist}"))
		}
		const cmdSanitized = cmd.replace(/\$\{testlist\}/, testlist).split(' ')

		logToChannel("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const getDefaultCommand = () => {
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

		let tempPath = workspace.asRelativePath(res.cfg.ablunitConfig.tempDirUri, false)
		if (isRelativePath(tempPath)) {
			tempPath = './' + tempPath
		}
		cmd.push('-T',tempPath)

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
					stdout = stdout.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
					options.appendOutput("_progres stdout=" + stdout + "\r\n")
				}
				if (stderr) {
					logToChannel("_progres stderr=" + stderr)
					stderr = stderr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
					options.appendOutput("_progres stderr=" + stderr + "\r\n")
				}
				if (err) {
					logToChannel("_progres err=" + err.toString(), 'error')
					err = err.toString().replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
					options.appendOutput("_progres err=" + err + '\r\n')
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
