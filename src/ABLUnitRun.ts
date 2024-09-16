import { CancellationError, CancellationToken, Disposable, FileSystemWatcher, TestRun, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { deleteFile, isRelativePath } from './ABLUnitCommon'
import { ExecException, ExecOptions, exec } from 'child_process'
import { log } from './ChannelLogger'
import { processUpdates } from 'parse/UpdateParser'

export enum RunStatus {
	None = 10,
	Initialized = 20,
	Constructed = 30,
	WaitingForStart = 40,
	Running = 50,
	Executing = 60,
	Parsing = 70,
	// 'done' states
	Complete = 80,
	Cancelled = 81,
	Error = 82,
}
export enum RunStatusString {
	'None' = 10,
	'Initialized' = 20,
	'Constructed' = 30,
	'WaitingForStart' = 40,
	'Running' = 50,
	'Executing' = 60,
	'Parsing' = 70,
	// 'done' states
	'Complete' = 80,
	'Cancelled' = 81,
	'Error' = 82,
}

export class ABLUnitRuntimeError extends Error {
	constructor (message: string, public promsgError: string, public cmd?: string) {
		super(message)
	}
}

export const ablunitRun = async (options: TestRun, res: ABLResults, cancellation: CancellationToken) => {
	const start = Date.now()
	const abort = new AbortController()
	const { signal } = abort
	let watcherDispose: Disposable | undefined = undefined
	let watcherUpdate: FileSystemWatcher | undefined = undefined

	cancellation.onCancellationRequested(() => {
		log.debug('cancellation requested - ablunitRun')
		abort.abort()
		if (watcherDispose) {
			watcherDispose.dispose()
		}
		if (watcherUpdate) {
			watcherUpdate.dispose()
		}
		throw new CancellationError()
	})

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.config_uri, res.cfg.ablunitConfig.options, res.testQueue)

	const getCommand = () => {
		if (res.cfg.ablunitConfig.command.executable != '_progres' &&
			res.cfg.ablunitConfig.command.executable != 'prowin' &&
			res.cfg.ablunitConfig.command.executable != 'prowin32') {
			return getCustomCommand()
		}
		return getDefaultCommand()
	}

	const getCustomCommand = () => {
		let cmd = res.cfg.ablunitConfig.command.executable.replace('${DLC}', res.dlc!.uri.fsPath.replace(/\\/g, '/'))

		const testarr: string[] = []
		for (const test of res.testQueue) {
			if (test.test) {
				testarr.push(test.test)
			}
		}
		const testlist = testarr.join(',')

		if (!cmd.includes('${testlist}')) {
			log.error('command does not contain ${testlist}', options)
			throw new Error('command does not contain ${testlist}')
		}
		cmd = cmd.replace(/\$\{testlist\}/, testlist)
		cmd = cmd.replace(/\$\{tempDir\}/, workspace.asRelativePath(res.cfg.ablunitConfig.tempDirUri, false))
		const cmdSanitized = cmd.split(' ')

		log.info('ABLUnit Command: ' + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const getDefaultCommand = () => {
		if (!res.cfg.ablunitConfig.tempDirUri) {
			throw new Error('temp directory not set')
		}

		const executable = res.dlc!.uri.fsPath.replace(/\\/g, '/') + '/bin/' + res.cfg.ablunitConfig.command.executable

		let cmd = [ executable, '-b', '-p', res.wrapperUri.fsPath.replace(/\\/g, '/') ]

		if (process.platform === 'win32') {
			if (res.cfg.ablunitConfig.progressIniUri) {
				cmd.push('-basekey', 'INI', '-ininame', workspace.asRelativePath(res.cfg.ablunitConfig.progressIniUri.fsPath, false))
			}
		} else if (process.platform === 'linux') {
			process.env['PROPATH'] = res.propath!.toString().replace(/\$\{DLC\}/g, res.dlc!.uri.fsPath.replace(/\\/g, '/'))
		} else {
			throw new Error('unsupported platform: ' + process.platform)
		}

		let tempPath = workspace.asRelativePath(res.cfg.ablunitConfig.tempDirUri, false)
		if (isRelativePath(tempPath)) {
			tempPath = './' + tempPath
		}
		cmd.push('-T', tempPath)

		if (res.cfg.ablunitConfig.dbConnPfUri && res.cfg.ablunitConfig.dbConns && res.cfg.ablunitConfig.dbConns.length > 0) {
			cmd.push('-pf', workspace.asRelativePath(res.cfg.ablunitConfig.dbConnPfUri.fsPath, false))
		}

		if (res.cfg.ablunitConfig.profiler.enabled) {
			cmd.push('-profile', workspace.asRelativePath(res.cfg.ablunitConfig.profOptsUri, false))
		}

		const cmdSanitized: string[] = []
		cmd = cmd.concat(res.cfg.ablunitConfig.command.additionalArgs)

		let params = 'CFG=' + workspace.asRelativePath(res.cfg.ablunitConfig.config_uri.fsPath, false) + '='
		if (res.cfg.ablunitConfig.dbAliases.length > 0) {
			params = params + ' ALIASES=' + res.cfg.ablunitConfig.dbAliases.join(';')
		}
		if (res.cfg.ablunitConfig.optionsUri.updateUri) {
			params = params + ' ATTR_ABLUNIT_EVENT_FILE=' + workspace.asRelativePath(res.cfg.ablunitConfig.optionsUri.updateUri, false)
		}
		cmd.push('-param', '"' + params + '"')

		cmd.forEach(element => {
			cmdSanitized.push(element.replace(/\\/g, '/'))
		})

		log.info('ABLUnit Command: ' + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const parseRuntimeError = (stdout: string): string | false => {
		// extract the last line that looks like a promsg format, assume it's an error to attach to a failing test case
		const promsgRegex = /^.* \(\d+\)/
		const lines = stdout.split('\n').reverse()

		for (const line of lines) {
			if (promsgRegex.test(line)) {
				return line
			}
		}
		return false
	}

	const runCommand = () => {
		log.debug('ablunit command dir=\'' + res.cfg.ablunitConfig.workspaceFolder.uri.fsPath + '\'')
		if (cancellation?.isCancellationRequested) {
			log.info('cancellation requested - runCommand')
			throw new CancellationError()
		}
		const args = getCommand()

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {
			res.setStatus(RunStatus.Executing)

			const runenv = getEnvVars(res.dlc!.uri)

			const execOpts: ExecOptions = {
				env: runenv,
				cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath,
				signal: signal,
				timeout: 120000
			}

			const execCommand = (cmd + ' ' + args.join(' ')).replace(/\$\{DLC\}/g, res.dlc!.uri.fsPath.replace(/\\/g, '/')) + ' 2>&1'

			log.info('command=\'' + cmd + ' ' + args.join(' ') + '\'\r\n', options)
			log.info('----- ABLUnit Command Execution Started -----', options)

			const updateUri = res.cfg.ablunitConfig.optionsUri.updateUri
			if (updateUri) {
				deleteFile(updateUri)
				log.info('watching test run update/event file: ' + updateUri.fsPath)
				watcherUpdate = workspace.createFileSystemWatcher(updateUri.fsPath)
				watcherDispose = watcherUpdate.onDidChange(uri => { return processUpdates(options, res, updateUri) })
			}

			exec(execCommand, execOpts, (err: ExecException | null, stdout: string, stderr: string) => {
				const duration = Date.now() - start

				if (err) {
					const errStr = '[err]\r\n' + JSON.stringify(err, null, 2) + '\r\n[\\err]'
					log.error(errStr, options)
				}
				if (stdout) {
					stdout = '[stdout] ' + stdout + '[\\stdout]'
					log.info(stdout, options)
				}
				if (stderr) {
					stderr = '[stderr] ' + stderr.replace(/\n/g, '\n[stderr] ')
					log.error(stderr, options)
				}

				if (err) {
					const promsgError = parseRuntimeError(stdout.replace(/\r/g, ''))
					log.debug('promsgError=' + promsgError, options)
					if (promsgError) {
						reject(new ABLUnitRuntimeError ('ABLUnit Runtime Error (code=' + err.code + ') !', promsgError, err.cmd))
					} else {
						reject(err)
					}
					return
				}
				if(stderr) {
					reject(new Error ('ABLUnit Command Execution Failed (reject-3) - duration: ' + duration + '\n' + stderr))
				}

				log.info('----- ABLUnit Command Execution Completed -----', options)
				if (watcherUpdate) {
					watcherUpdate.dispose()
				}
				if (watcherDispose) {
					watcherDispose.dispose()
				}
				resolve('ABLUnit Command Execution Completed - duration: ' + duration)
			})
		})
	}

	return runCommand().then(() => {
		return res.parseOutput(options)
	}, (err: unknown) => {
		log.debug('runCommand() error=' + JSON.stringify(err, null, 2), options)
		throw err
	})
}

export const getEnvVars = (dlcUri: Uri | undefined) => {
	const runenv = process.env
	let envConfig: Record<string, string> | undefined = undefined
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
				runenv[key] = envConfig[key].replace('${env:PATH}', process.env['PATH'])
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
