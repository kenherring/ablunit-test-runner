import { CancellationError, CancellationToken, Disposable, FileSystemWatcher, TestRun, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { deleteFile, Duration } from './ABLUnitCommon'
import { SendHandle, Serializable, SpawnOptions, spawn } from 'child_process'
import { log } from './ChannelLogger'
import { processUpdates, setTimeoutTestStatus, updateParserInit } from 'parse/UpdateParser'

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
	Killed = 83,
	Timeout = 84,
	Unknown = 99,
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
		this.name = 'ABLUnitRuntimeError'
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface ITimeoutError extends Error {
	duration: Duration
	limit: number
	cmd?: string
}

export class TimeoutError extends Error implements ITimeoutError {
	duration: Duration
	limit: number
	cmd?: string

	constructor (message: string, duration: Duration, limit: number, cmd: string) {
		super(message)
		this.name = 'TimeoutError'
		this.duration = duration
		this.limit = limit
		this.cmd = cmd
	}
}

export const ablunitRun = async (options: TestRun, res: ABLResults, cancellation: CancellationToken) => {
	const abort = new AbortController()
	const { signal } = abort
	let watcherDispose: Disposable | undefined = undefined
	let watcherUpdate: FileSystemWatcher | undefined = undefined

	cancellation.onCancellationRequested(async () => {
		log.debug('cancellation requested - ablunitRun')
		abort.abort()
		if (res.cfg.ablunitConfig.optionsUri.updateUri) {
			await processUpdates(options, res.tests, res.cfg.ablunitConfig.optionsUri.updateUri)
		}
		if (watcherDispose) {
			watcherDispose.dispose()
		}
		if (watcherUpdate) {
			watcherUpdate.dispose()
		}
		throw new CancellationError()
	})

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.config_uri, res.cfg.ablunitConfig.options, res.topLevelTests)

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
			// this is intentionally not a string substitution.  The variable is a literal part of the string.
			log.error('command does not contain \'${testlist}\'', options)
			throw new Error('command does not contain \'${testlist}\'')
		}
		cmd = cmd.replace(/\$\{testlist\}/, testlist)
		cmd = cmd.replace(/\$\{tempDir\}/, res.cfg.ablunitConfig.tempDirUri.fsPath)
		const cmdSanitized = cmd.split(' ')

		log.info('ABLUnit Command: ' + cmdSanitized.join(' '))
		return cmdSanitized
	}

	const getDefaultCommand = () => {
		if (!res.cfg.ablunitConfig.tempDirUri) {
			throw new Error('temp directory not set')
		}

		const executable = res.dlc!.uri.fsPath.replace(/\\/g, '/') + '/bin/' + res.cfg.ablunitConfig.command.executable

		const cmd = [ executable, '-b', '-p', res.wrapperUri.fsPath.replace(/\\/g, '/') ]

		if (process.platform === 'win32') {
			if (res.cfg.ablunitConfig.progressIniUri) {
				cmd.push('-basekey', 'INI', '-ininame', res.cfg.ablunitConfig.progressIniUri.fsPath)
			}
		} else if (process.platform === 'linux') {
			process.env['PROPATH'] = res.propath!.toString().replace(/\$\{DLC\}/g, res.dlc!.uri.fsPath.replace(/\\/g, '/'))
		} else {
			throw new Error('unsupported platform: ' + process.platform)
		}

		cmd.push('-T', res.cfg.ablunitConfig.tempDirUri.fsPath)

		if (res.cfg.ablunitConfig.dbConnPfUri && res.cfg.ablunitConfig.dbConns && res.cfg.ablunitConfig.dbConns.length > 0) {
			cmd.push('-pf', res.cfg.ablunitConfig.dbConnPfUri.fsPath)
		}

		if (res.cfg.ablunitConfig.profiler.enabled) {
			cmd.push('-profile', res.cfg.ablunitConfig.profOptsUri.fsPath)
		}

		const cmdSanitized: string[] = []
		cmd.push(...res.cfg.ablunitConfig.command.additionalArgs)

		let params = 'CFG=' + res.cfg.ablunitConfig.config_uri.fsPath + '='
		if (res.cfg.ablunitConfig.dbAliases.length > 0) {
			params = params + ' ALIASES=' + res.cfg.ablunitConfig.dbAliases.join(';')
		}
		if (res.cfg.ablunitConfig.optionsUri.updateUri) {
			params = params + ' ATTR_ABLUNIT_EVENT_FILE=' + res.cfg.ablunitConfig.optionsUri.updateUri.fsPath
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
		deleteFile(res.cfg.ablunitConfig.profFilenameUri)
		// deleteFile(res.cfg.ablunitConfig.config_uri)
		deleteFile(res.cfg.ablunitConfig.optionsUri.filenameUri)
		deleteFile(res.cfg.ablunitConfig.optionsUri.jsonUri)
		deleteFile(res.cfg.ablunitConfig.optionsUri.updateUri)
		deleteFile(res.cfg.ablunitConfig.profFilenameUri)
		// deleteFile(res.cfg.ablunitConfig.profOptsUri)

		log.debug('ablunit command dir=\'' + res.cfg.ablunitConfig.workspaceFolder.uri.fsPath + '\'')
		if (cancellation?.isCancellationRequested) {
			log.info('cancellation requested - runCommand')
			throw new CancellationError()
		}
		const args = getCommand()

		const cmd = args[0]
		args.shift()

		return new Promise<string>((resolve, reject) => {
			res.setStatus(RunStatus.Running)
			const runenv = getEnvVars(res.dlc!.uri)

			const updateUri = res.cfg.ablunitConfig.optionsUri.updateUri
			if (updateUri) {
				updateParserInit()
				log.info('watching test run update/event file: ' + updateUri.fsPath)
				watcherUpdate = workspace.createFileSystemWatcher(updateUri.fsPath)
				watcherDispose = watcherUpdate.onDidChange((uri) => { return processUpdates(options, res.tests, uri) })
			}

			const spawnOpts: SpawnOptions = {
				signal: signal,
				// killSignal: 'SIGKILL', // DEFAULT
				// killSignal: 'SIGABRT', // does not actually kill the process
				// killSignal: 'SIGINT', // works in windows
				// killSignal: 'SIGHUP', // works in linux
				killSignal: 'SIGTERM',
				timeout: res.cfg.ablunitConfig.timeout,
				env: runenv,
				cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath,
			}

			log.info('command=\'' + cmd + ' ' + JSON.stringify(args) + '\'\r\n', options)
			const testRunDuration = new Duration('TestRun')
			const process = spawn(cmd, args, spawnOpts)

			let lastError: string | undefined = undefined

			process.stderr?.on('data', (data: Buffer) => {
				void processUpdates(options, res.tests, updateUri)
				log.error('\t\t[stderr] ' + data.toString().trim().replace(/\n/g, '\n\t\t[stderr]'), options)
				lastError = data.toString().trim()
			})
			process.stdout?.on('data', (data: Buffer) => {
				void processUpdates(options, res.tests, updateUri)
				log.info('\t\t[stdout] ' + data.toString().trim().replace(/\n/g, '\n\t\t[stdout]'), options)
				lastError = undefined
			})
			process.once('spawn', () => {
				res.setStatus(RunStatus.Executing)
				log.info('----- ABLUnit Test Run Started -----', options)
			}).on('error', (e: Error) => {
				log.debug('process.error e=' + e)
				res.setStatus(RunStatus.Error, 'e=' + e)
				log.error('----- ABLUnit Test Run Error ----- (e=' + e + ')', options)
				if (e instanceof Error) {
					reject(e)
				}
			}).on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
				testRunDuration.stop()
				log.debug('process.exit code=' + code + '; signal=' + signal + '; process.exitCode=' + process.exitCode + '; process.signalCode=' + process.signalCode + '; killed=' + process.killed)
				void processUpdates(options, res.tests, updateUri)
				if (process.killed || signal) {
					setTimeoutTestStatus(options, res.cfg.ablunitConfig.timeout)
					res.setStatus(RunStatus.Timeout, 'signal=' + signal)
					log.info('----- ABLUnit Test Run Timeout - ' + res.cfg.ablunitConfig.timeout + 'ms ----- ' + testRunDuration, options)
					reject(new TimeoutError('ABLUnit process timeout', testRunDuration, res.cfg.ablunitConfig.timeout, cmd))
					return
				}
				if (process.killed) {
					res.setStatus(RunStatus.Killed, 'signal=' + signal)
					log.info('----- ABLUnit Test Run Killed - (signal=' + signal + ') ----- ' + testRunDuration, options)
					reject(new ABLUnitRuntimeError('ABLUnit process killed', 'exit_code=' + code + '; signal=' + signal, cmd))
					return
				}

				if (code && code != 0) {
					res.setStatus(RunStatus.Error, 'exit_code=' + code)
					log.info('----- ABLUnit Test Run Failed (exit_code=' + code + ') ----- ' + testRunDuration, options)
					reject(new ABLUnitRuntimeError('ABLUnit exit_code= ' + code, 'ABLUnit exit_code= ' + code + '; signal=' + signal, cmd))
					return
				}


				// eslint-disable-next-line promise/catch-or-return
				processUpdates(options, res.tests, updateUri).then(() => {
					log.info('final ingest from updates file completed successfully')
					res.setStatus(RunStatus.Complete, 'success')
					log.info('----- ABLUnit Test Run Complete ----- ' + testRunDuration, options)
				}, (e: unknown) => {
					throw e
				})
				resolve('success')
			}).on('close', (code: number | null, signal: NodeJS.Signals | null) => {
				log.debug('process.close code=' + code + '; signal=' + signal + '; process.exitCode=' + process.exitCode + '; process.signalCode=' + process.signalCode + '; killed=' + process.killed)

				watcherDispose?.dispose()
				watcherUpdate?.dispose()
				void processUpdates(options, res.tests, updateUri)

				log.info('process.close event')
				log.info('\tcode=' + code)
				log.info('\tsignal=' + signal)
				log.info('\tprocess.exitCode=' + process.exitCode)
				log.info('\tprocess.signalCode=' + process.signalCode)
				log.info('\tprocess.killed=' + process.killed)
				log.info('\tprocess.pid=' + process.pid)
				log.info('\tprocess.connected' + process.connected)
				log.info('\tprocess.channel=' + process.channel)

				if (lastError && res.status < RunStatus.Complete) {
					if (lastError) {
						res.setStatus(RunStatus.Error)
						log.info('----- ABLUnit Test Run Runtime Error (exit_code=' + code + ') ----- ' + testRunDuration, options)
						reject(new ABLUnitRuntimeError('ABLUnit runtime error', lastError, cmd))
						return
					}
				}
				if (res.status < RunStatus.Complete) {
					const currentStatus = res.status
					res.setStatus(RunStatus.Unknown, 'ABLUnit process closed unexpectedly, should have called exit already (RunStatus=' + currentStatus + ')')
					reject(new ABLUnitRuntimeError('ABLUnit process closed unexpectedly', 'RunStatus=' + currentStatus + '; code=' + code + '; signal=' + signal, cmd))
					return
				}
				reject(new Error('Unknown error - ABLUnit process closed but was not processed correctly'))
			}).on('message', (m: Serializable, h: SendHandle) => {
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				log.info('process.on.message m=' + m.toString())
			})
		})
	}

	return runCommand()
		.then(() => {
			return res.parseOutput(options)
		}, (e: unknown) => {
			log.debug('runCommand() error=' + JSON.stringify(e, null, 2), options)
			if (e instanceof Error) {
				res.thrownError = e
			}
			throw e
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
