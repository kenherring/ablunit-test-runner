import { TestRun, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { logToChannel } from './ABLUnitCommon'
import { isRelativePath } from './ABLUnitConfigWriter'
import { ExecException, exec } from "child_process"

export const ablunitRun = async (options: TestRun, res: ABLResults) => {
	const start = Date.now()

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.config_uri, res.cfg.ablunitConfig.options, res.testQueue)

	const getCommand = () => {
		if (res.cfg.ablunitConfig.command.executable != "_progres" &&
			res.cfg.ablunitConfig.command.executable != "prowin" &&
			res.cfg.ablunitConfig.command.executable != "prowin32") {
			return getCustomCommand()
		}
		return getDefaultCommand()
	}

	const getCustomCommand = () => {
		const cmd = res.cfg.ablunitConfig.command.executable.replace("${DLC}", res.dlc!.uri.fsPath.replace(/\\/g, '/'))

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

		const executable = res.dlc!.uri.fsPath.replace(/\\/g, '/') + '/bin/' + res.cfg.ablunitConfig.command.executable

		let cmd = [ executable, '-b', '-p', res.wrapperUri.fsPath.replace(/\\/g,'/') ]

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

		if (res.cfg.ablunitConfig.dbConnPfUri) {
			cmd.push('-pf', workspace.asRelativePath(res.cfg.ablunitConfig.dbConnPfUri.fsPath, false))
		}

		if (res.cfg.ablunitConfig.profiler.enabled) {
			cmd.push('-profile', workspace.asRelativePath(res.cfg.ablunitConfig.profOptsUri, false))
		}

		const cmdSanitized: string[] = []
		cmd = cmd.concat(res.cfg.ablunitConfig.command.additionalArgs)

		let params = "CFG=" + workspace.asRelativePath(res.cfg.ablunitConfig.config_uri.fsPath, false)
		if (res.cfg.ablunitConfig.dbAliases) {
			params = params + " = ALIASES=" + res.cfg.ablunitConfig.dbAliases.join(';')
		}
		cmd.push("-param", '"' + params + '"')

		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		})

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

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			exec(cmd + ' ' + args.join(' '), {env: process.env, cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath }, (err: ExecException | null, stdout: string, stderr: string) => {
				const duration = Date.now() - start
				if (stdout) {
					logToChannel("_progres stdout=" + stdout, 'log', options)
				}
				if (stderr) {
					logToChannel("_progres stderr=" + stderr, 'error', options)
				}
				if (err) {
					logToChannel("_progres err=" + err.name + " (ExecExcetion)\r\n   " + err.message, 'error', options)
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
		return res.parseOutput(options).then()
	})
}
