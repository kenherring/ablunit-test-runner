import { CancellationToken, TestRun, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { isRelativePath } from './ABLUnitConfigWriter'
import { ExecException, ExecOptions, exec } from "child_process"
import log from './ChannelLogger'

export const ablunitRun = async (options: TestRun, res: ABLResults, cancellation?: CancellationToken) => {
	const start = Date.now()
	const abort = new AbortController()
	const { signal } = abort

	if (cancellation) {
		cancellation.onCancellationRequested(() => {
			log.info("cancellation requested")
			abort.abort()
		})
	}

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
		let cmd = res.cfg.ablunitConfig.command.executable.replace("${DLC}", res.dlc!.uri.fsPath.replace(/\\/g, '/'))

		const testarr: string[] = []
		for (const test of res.testQueue) {
			if (test.test) {
				testarr.push(test.test)
			}
		}
		const testlist = testarr.join(',')

		if (!cmd.includes('${testlist}')) {
			log.error("command does not contain ${testlist}", options)
			throw (new Error("command does not contain ${testlist}"))
		}
		cmd = cmd.replace(/\$\{testlist\}/, testlist)
		cmd = cmd.replace(/\$\{tempDir\}/, workspace.asRelativePath(res.cfg.ablunitConfig.tempDirUri, false))
		const cmdSanitized = cmd.split(' ')

		log.info("ABLUnit Command: " + cmdSanitized.join(' '))
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
			process.env['PROPATH'] = res.propath!.toString()
		} else {
			throw new Error("unsupported platform: " + process.platform)
		}

		let tempPath = workspace.asRelativePath(res.cfg.ablunitConfig.tempDirUri, false)
		if (isRelativePath(tempPath)) {
			tempPath = './' + tempPath
		}
		cmd.push('-T',tempPath)

		if (res.cfg.ablunitConfig.dbConnPfUri && res.cfg.ablunitConfig.dbConns && res.cfg.ablunitConfig.dbConns.length > 0) {
			cmd.push('-pf', workspace.asRelativePath(res.cfg.ablunitConfig.dbConnPfUri.fsPath, false))
		}

		if (res.cfg.ablunitConfig.profiler.enabled) {
			cmd.push('-profile', workspace.asRelativePath(res.cfg.ablunitConfig.profOptsUri, false))
		}

		const cmdSanitized: string[] = []
		cmd = cmd.concat(res.cfg.ablunitConfig.command.additionalArgs)

		let params = "CFG=" + workspace.asRelativePath(res.cfg.ablunitConfig.config_uri.fsPath, false)
		if (res.cfg.ablunitConfig.dbAliases.length > 0) {
			params = params + "= ALIASES=" + res.cfg.ablunitConfig.dbAliases.join(';')
		}
		cmd.push("-param", '"' + params + '"')

		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		})

		log.info("ABLUnit Command: " + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const runCommand = () => {
		log.debug("ablunit command dir='" + res.cfg.ablunitConfig.workspaceFolder.uri.fsPath + "'")
		log.info("----- ABLUnit Command Execution Started -----", options)
		const args = getCommand()

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {
			res.setStatus("running command")

			const runenv = getEnvVars(res.dlc!.uri)
			log.debug("cmd=" + cmd + ' ' + args.join(' '))

			const execOpts: ExecOptions = {
				env: runenv,
				cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath,
				signal: signal,
				timeout: 120000
			}

			exec(cmd + ' ' + args.join(' ') + ' 2>&1', execOpts, (err: ExecException | null, stdout: string, stderr: string) => {
				const duration = Date.now() - start
				if (err) {
					log.error("Error = " + err.name + " (ExecExcetion)\r\n   " + err.message, options)
					log.error("err=" + JSON.stringify(err))
					reject(err)
				}
				if (stdout) {
					// stdout = '[stdout] ' + stdout.replace(/\n/g, '\n[stdout] ')
					log.info(stdout, options)
				}
				if (stderr) {
					stderr = '[stderr] ' + stderr.replace(/\n/g, '\n[stderr] ')
					log.error(stderr, options)
				}
				// if(stderr) {
				// 	reject(new Error ("ABLUnit Command Execution Failed - duration: " + duration))
				// }
				log.info("----- ABLUnit Command Execution Completed -----", options)
				resolve("ABLUnit Command Execution Completed - duration: " + duration)
			})
		})
	}

	return runCommand().then(() => {
		return res.parseOutput(options).then()
	}, (err) => {
		log.error("Err=" + err)
	})
}

export const getEnvVars = (dlcUri: Uri | undefined) => {
	const runenv = process.env
	let envConfig: {[key: string]: string} | undefined = undefined
	if (process.platform === 'win32') {
		envConfig = workspace.getConfiguration('terminal').get('integrated.env.windows')
	} else if (process.platform === 'linux') {
		envConfig = workspace.getConfiguration('terminal').get('integrated.env.linux')
	} else if (process.platform === 'darwin') {
		envConfig = workspace.getConfiguration('terminal').get('integrated.env.osx')
	}
	if (envConfig) {
		for (const key of Object.keys(envConfig)) {
			if (key === 'PATH' && process.env['PATH']) {
				runenv[key] = envConfig[key].replace("${env:PATH}", process.env['PATH'])
			} else {
				runenv[key] = envConfig[key]
			}
		}
	}
	if (dlcUri) {
		runenv['DLC'] = dlcUri.fsPath.replace(/\\/g, '/')
	}
	return runenv
}
