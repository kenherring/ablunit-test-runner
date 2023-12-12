import { TestRun, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { logToChannel } from './ABLUnitCommon'
import { isRelativePath } from './ABLUnitConfigWriter';
import { exec } from "child_process";

export const ablunitRun = async(options: TestRun, res: ABLResults) => {
	const start = Date.now()

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.config_uri, res.cfg.ablunitConfig.coreOpts, res.testQueue)

	const getCommand = () => {
		if (res.cfg.ablunitConfig.command.executable != "") {
			return getCustomCommand()
		}
		return getDefaultCommand()
	}

	const getCustomCommand = () => {
		const cmd = res.cfg.ablunitConfig.command.executable

		const testarr: string[] = []
		for (const test of res.testQueue) {
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

		let cmd = [ '_progres', '-b', '-p', 'ABLUnitCore.p' ]
		if (res.dlc) {
			cmd = [res.dlc.uri.fsPath + '/bin/_progres', '-b', '-p', 'ABLUnitCore.p']
		}

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

		if (res.cfg.ablunitConfig.profOpts.enabled) {
			cmd.push('-profile', workspace.asRelativePath(res.cfg.ablunitConfig.profOptsUri, false))
		}

		const cmdSanitized: string[] = []
		cmd = cmd.concat(res.cfg.ablunitConfig.command.additionalArgs)

		cmd.push("-param", '"CFG=' + workspace.asRelativePath(res.cfg.ablunitConfig.config_uri.fsPath, false) + '"')
		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		});

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

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			exec(cmd + ' ' + args.join(' '), {env: process.env, cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath }, (err: any, stdout: any, stderr: any) => {
				const duration = Date.now() - start
				if (stdout) {
					logToChannel("_progres stdout=" + stdout)
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
					stdout = stdout.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
					options.appendOutput("_progres stdout=" + stdout + "\r\n")
				}
				if (stderr) {
					logToChannel("_progres stderr=" + stderr)
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
					stderr = stderr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
					options.appendOutput("_progres stderr=" + stderr + "\r\n")
				}
				if (err) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
					logToChannel("_progres err=" + err.toString(), 'error')
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
