import { CancellationError, CancellationToken, TestItem, TestRun, TestRunProfileKind, Uri, workspace } from 'vscode'
import { ABLResults } from './ABLResults'
import { Duration, gatherAllTestItems } from './ABLUnitCommon'
import { SendHandle, Serializable, SpawnOptions, spawn } from 'child_process'
import { log } from './ChannelLogger'
import { processUpdates, setTimeoutTestStatus } from 'parse/UpdateParser'
import { basename, dirname } from 'path'
import { globSync } from 'glob'
import * as fs from 'fs'
import * as FileUtils from './FileUtils'
import { ABLCompileError, ABLUnitRuntimeError, ICompileError, TimeoutError } from 'Errors'

interface IABLUnitStatus {
	action: string,
	entityId?: number,
	entityName?: string,
}

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

export const ablunitRun = async (options: TestRun, res: ABLResults, cancellation: CancellationToken) => {
	const abort = new AbortController()
	const { signal } = abort
	let watcher: fs.StatWatcher | undefined = undefined
	const compileErrors: ICompileError[] = []
	let currentTestItem: TestItem | undefined = undefined
	const allTests: TestItem[] = []
	for (const test of res.tests) {
		allTests.push(test, ...gatherAllTestItems(test.children))
	}

	cancellation.onCancellationRequested(() => {
		log.debug('cancellation requested - ablunitRun')
		abort.abort()
		if (res.cfg.ablunitConfig.optionsUri.updateUri) {
			if (watcher) {
				watcher.removeAllListeners()
			}
			processUpdates(options, res.tests, res.cfg.ablunitConfig.optionsUri.updateUri)
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
		let cmd = res.cfg.ablunitConfig.command.executable.replace('${DLC}', res.dlc.uri.fsPath.replace(/\\/g, '/'))

		const testarr: string[] = []
		for (const test of res.testQueue) {
			if (test.test) {
				testarr.push(test.test)
			}
		}
		const testlist = testarr.join(',')

		if (!cmd.includes('${testlist}')) {
			// this is intentionally not a string substitution.  The variable is a literal part of the string.
			log.error('command does not contain \'${testlist}\'', {testRun: options, testItem: currentTestItem })
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

		const executable = res.dlc.uri.fsPath.replace(/\\/g, '/') + '/bin/' + res.cfg.ablunitConfig.command.executable

		const cmd = [ executable, '-b', '-p', res.wrapperUri.fsPath.replace(/\\/g, '/') ]

		if (process.platform === 'win32') {
			if (res.cfg.ablunitConfig.progressIniUri) {
				cmd.push('-basekey', 'INI', '-ininame', res.cfg.ablunitConfig.progressIniUri.fsPath)
			}
		} else if (process.platform === 'linux') {
			process.env['PROPATH'] = res.propath.toString().replace(/\$\{DLC\}/g, res.dlc.uri.fsPath.replace(/\\/g, '/'))
		} else {
			throw new Error('unsupported platform: ' + process.platform)
		}

		cmd.push('-T', res.cfg.ablunitConfig.tempDirUri.fsPath)

		if (res.cfg.ablunitConfig.dbConnPfUri && res.cfg.ablunitConfig.dbConns && res.cfg.ablunitConfig.dbConns.length > 0) {
			cmd.push('-pf', res.cfg.ablunitConfig.dbConnPfUri.fsPath)
		}

		if (res.cfg.ablunitConfig.profiler.enabled && res.cfg.requestKind == TestRunProfileKind.Coverage) {
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

	const _parseRuntimeError = (stdout: string): string | false => {
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

	const setCurrentTestItem = (ablunitStatus: IABLUnitStatus) => {
		if (ablunitStatus.action == 'TEST_START' && ablunitStatus.entityName) {
			const parts = ablunitStatus.entityName?.split(' ')
			currentTestItem = allTests.find(test => test.label == parts[parts.length - 1])
		} else {
			currentTestItem = undefined
		}
	}

	const runCommand = () => {
		FileUtils.deleteFile([
			res.cfg.ablunitConfig.profFilenameUri,
			// res.cfg.ablunitConfig.config_uri,
			res.cfg.ablunitConfig.optionsUri.filenameUri,
			res.cfg.ablunitConfig.optionsUri.jsonUri,
			res.cfg.ablunitConfig.optionsUri.updateUri,
			res.cfg.ablunitConfig.profFilenameUri,
			// res.cfg.ablunitConfig.profOptsUri,
		])

		if (res.cfg.ablunitConfig.optionsUri.updateUri) {
			fs.writeFileSync(res.cfg.ablunitConfig.optionsUri.updateUri.fsPath, '')
		}

		if (res.cfg.ablunitConfig.profFilenameUri) {
			const profDir = dirname(res.cfg.ablunitConfig.profFilenameUri.fsPath)
			const profFile = basename(res.cfg.ablunitConfig.profFilenameUri.fsPath)
			const globPattern = profFile.replace(/(.*)\.([a-zA-Z]+)$/, '$1_*.$2')

			const dataFiles = globSync(globPattern, { cwd: profDir })
			dataFiles.push(...globSync(globPattern.replace(/\.[a-zA-Z]+$/, '.json'), { cwd: profDir }))
			for (const dataFile of dataFiles) {
				FileUtils.deleteFile(Uri.joinPath(Uri.file(profDir), dataFile))
			}
		}

		log.debug('ablunit command dir=\'' + res.cfg.ablunitConfig.workspaceFolder.uri.fsPath + '\'')
		if (cancellation?.isCancellationRequested) {
			log.info('cancellation requested - runCommand')
			throw new CancellationError()
		}
		const args = getCommand()

		const cmd = args[0]
		args.shift()

		if (res.cfg.ablunitConfig.optionsUri.updateUri) {
			watcher = fs.watchFile(res.cfg.ablunitConfig.optionsUri.updateUri.fsPath, (_curr, _prev) => {
				processUpdates(options, res.tests, res.cfg.ablunitConfig.optionsUri.updateUri)
			})
		}

		let stdout = ''

		return new Promise<string>((resolve, reject) => {
			res.setStatus(RunStatus.Running)
			const runenv = getEnvVars(res.dlc.uri)
			const updateUri = res.cfg.ablunitConfig.optionsUri.updateUri

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
				shell: true,
			}

			log.info('command=\'' + cmd + ' ' + args.join(' ') + '\'\r\n', {testRun: options, testItem: currentTestItem })
			const testRunDuration = new Duration('TestRun')
			const process = spawn(cmd, args, spawnOpts)

			process.stderr?.on('data', (data: Buffer) => {
				log.debug('stderr', {testRun: options})
				log.error('\t\t[stderr] ' + data.toString().trim().replace(/\n/g, '\n\t\t[stderr] '), {testRun: options, testItem: currentTestItem})
			})
			process.stdout?.on('data', (data: Buffer) => {
				log.debug('stdout', {testRun: options})
				stdout = stdout + data.toString()
				const lines = stdout.split('\n')
				if (lines[lines.length - 1] == '') {
					lines.pop()
				} else {
					stdout = lines.pop() ?? ''
				}
				for (const line of lines) {
					if (line.startsWith('ABLUNIT_STATUS=SERIALIZED_ERROR ')) {
						const compilerError = JSON.parse(line.substring(32)) as ICompileError
						compileErrors.push(compilerError)
						continue
					} else if (line.startsWith('ABLUNIT_STATUS=')) {
						let ablunitStatus: IABLUnitStatus
						try {
							ablunitStatus = JSON.parse(line.substring(15)) as IABLUnitStatus
						} catch (e) {
							log.error('error parsing ablunitStatus: ' + e)
							ablunitStatus = { action: 'ParsingError' }
						}
						if (ablunitStatus.action == 'TEST_START' || ablunitStatus.action == 'TEST_END') {
							setCurrentTestItem(ablunitStatus)
						}
						continue
					}

					if (currentTestItem) {
						log.info('\t\t[stdout] [' + currentTestItem.label + '] ' + line, {testRun: options, testItem: currentTestItem})
					} else {
						log.info('\t\t[stdout] ' + line, {testRun: options, testItem: currentTestItem})
					}
				}
				log.info('process.stdout complete')
			})
			process.once('spawn', () => {
				log.debug('spawn', {testRun: options})
				res.setStatus(RunStatus.Executing)
				log.info('----- ABLUnit Test Run Started -----', {testRun: options, testItem: currentTestItem })
			}).on('disconnect', () => {
				log.debug('process.disconnect', {testRun: options})
				log.info('process.disconnect')
			}).on('error', (e: Error) => {
				log.debug('error', {testRun: options})
				log.info('process.error e=' + e)
				res.setStatus(RunStatus.Error, 'e=' + e)
				log.error('----- ABLUnit Test Run Error -----', {testRun: options, testItem: currentTestItem })
				if (e instanceof Error) {
					reject(e)
				}
			}).on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
				log.debug('exit', {testRun: options})
				log.info('process.exit code=' + code + '; signal=' + signal + '; process.exitCode=' + process.exitCode + '; process.signalCode=' + process.signalCode + '; killed=' + process.killed)
				testRunDuration.stop()
				if (watcher) {
					watcher.removeAllListeners()
				}
				processUpdates(options, res.tests, updateUri)
				if (process.killed || signal) {
					setTimeoutTestStatus(options, res.cfg.ablunitConfig.timeout)
					res.setStatus(RunStatus.Timeout, 'signal=' + signal)
					log.info('----- ABLUnit Test Run Timeout - ' + res.cfg.ablunitConfig.timeout + 'ms ----- ' + testRunDuration, {testRun: options, testItem: currentTestItem })
					reject(new TimeoutError('ABLUnit process timeout', testRunDuration, res.cfg.ablunitConfig.timeout, cmd))
					return
				}
				if (process.killed) {
					res.setStatus(RunStatus.Killed, 'signal=' + signal)
					log.info('----- ABLUnit Test Run Killed - (signal=' + signal + ') ----- ' + testRunDuration, {testRun: options, testItem: currentTestItem })
					reject(new ABLUnitRuntimeError('ABLUnit process killed', 'exit_code=' + code + '; signal=' + signal, cmd))
					return
				}

				if (code && code != 0) {
					if (compileErrors.length > 0) {
						res.setStatus(RunStatus.Error, 'compile_errors=' + compileErrors.length)
						log.info('----- ABLUnit Test Run Failed (compile_errors=' + compileErrors.length + ') ----- ' + testRunDuration, {testRun: options, testItem: currentTestItem })
						reject(new ABLCompileError(compileErrors, cmd))
						return
					}
					res.setStatus(RunStatus.Error, 'exit_code=' + code)
					log.info('----- ABLUnit Test Run Failed (exit_code=' + code + ') ----- ' + testRunDuration, {testRun: options, testItem: currentTestItem })
					reject(new ABLUnitRuntimeError('ABLUnit exit_code=' + code, 'ABLUnit exit_code=' + code + '; signal=' + signal, cmd))
					return
				}

				res.setStatus(RunStatus.Complete, 'success')
				log.info('----- ABLUnit Test Run Complete ----- ' + testRunDuration, {testRun: options, testItem: currentTestItem })
				resolve('success')
			}).on('close', (code: number | null, signal: NodeJS.Signals | null) => {
				log.debug('close', {testRun: options})
				log.info('process.close code=' + code + '; signal=' + signal + '; process.exitCode=' + process.exitCode + '; process.signalCode=' + process.signalCode + '; killed=' + process.killed)
			}).on('message', (m: Serializable, _h: SendHandle) => {
				log.debug('message', {testRun: options})
				log.info('process.on.message m=' + JSON.stringify(m))
			})
		})
	}

	return runCommand()
		.then(() => {
			log.info('runCommand() success')
			return res.parseOutput(options)
		}, (e: unknown) => {
			log.info('runCommand() error=' + JSON.stringify(e, null, 2))
			if (e instanceof Error) {
				log.info('res.thrownError=' + e)
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
