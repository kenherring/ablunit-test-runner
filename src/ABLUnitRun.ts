import { CancellationError, CancellationToken, debug, DebugConfiguration, TestItem, TestMessage, TestRun, TestRunProfileKind, Uri, workspace } from 'vscode'
import { ABLResults } from 'ABLResults'
import { Duration, gatherAllTestItems } from 'ABLUnitCommon'
import { SendHandle, Serializable, SpawnOptions, spawn } from 'child_process'
import { log } from 'ChannelLogger'
import { basename, dirname } from 'path'
import { globSync } from 'glob'
import { ABLCompilerError, ABLUnitRuntimeError, ICompilerError, TimeoutError } from 'Errors'
import treeKill from 'tree-kill'
import * as fs from 'fs'
import * as FileUtils from 'FileUtils'

interface IABLUnitStatus {
	action: string,
	entityId?: number,
	entityName?: string,
	duration?: string,
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

const debugLaunchProfile: DebugConfiguration = {
	name: 'ablunit-test-runner',
	type: 'abl',
	request: 'attach',
	hostname: 'localhost',
	mode: 'legacy',
	port: 3199,
	localRoot: '${workspaceFolder}',
}

let abort: AbortController
let allTests: TestItem[] = []
const currentTestItems: TestItem[] = []

export async function ablunitRun (options: TestRun, res: ABLResults, cancellation: CancellationToken) {
	abort = new AbortController()
	allTests = gatherAllTestItems(res.tests)

	cancellation.onCancellationRequested(() => {
		log.debug('cancellation requested - ablunitRun')
		abort.abort()
		throw new CancellationError()
	})

	await res.cfg.createAblunitJson(res.cfg.ablunitConfig.config_uri, res.cfg.ablunitConfig.options, res.testQueue)

	await runCommand(res, options, cancellation)
		.then((r) => {
			log.info('runCommand complete (r=' + r + ')')
			return r
		}, (e: unknown) => {
			log.info('runCommand threw error! e=' + e)
			throw e
		})
}

function getCommand (res: ABLResults, options: TestRun) {
	if (res.cfg.ablunitConfig.command.executable != '_progres' &&
		res.cfg.ablunitConfig.command.executable != 'prowin' &&
		res.cfg.ablunitConfig.command.executable != 'prowin32') {
		return getCustomCommand(res, options)
	}
	return getDefaultCommand(res)
}

function getCustomCommand (res: ABLResults, options: TestRun) {
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
		log.error('command does not contain \'${testlist}\'', {testRun: options})
		throw new Error('command does not contain \'${testlist}\'')
	}
	cmd = cmd.replace(/\$\{testlist\}/, testlist)
	cmd = cmd.replace(/\$\{tempDir\}/, res.cfg.ablunitConfig.tempDirUri.fsPath)
	const cmdSanitized = cmd.split(' ')

	log.info('ABLUnit Command: ' + cmdSanitized.join(' '))
	return cmdSanitized
}

function getDefaultCommand (res: ABLResults) {
	if (!res.cfg.ablunitConfig.tempDirUri) {
		throw new Error('temp directory not set')
	}

	const executable = res.dlc.uri.fsPath.replace(/\\/g, '/') + '/bin/' + res.cfg.ablunitConfig.command.executable

	const cmd = [ executable, '-b', '-p', res.wrapperUri.fsPath.replace(/\\/g, '/') ]

	process.env['PROPATH'] = res.propath.toString().replace(/\$\{DLC\}/g, res.dlc.uri.fsPath.replace(/\\/g, '/'))

	cmd.push('-T', res.cfg.ablunitConfig.tempDirUri.fsPath)

	if (res.cfg.ablunitConfig.dbConnPfUri && res.cfg.ablunitConfig.dbConns && res.cfg.ablunitConfig.dbConns.length > 0) {
		cmd.push('-pf', res.cfg.ablunitConfig.dbConnPfUri.fsPath)
	}

	if (res.cfg.ablunitConfig.profiler.enabled && res.cfg.requestKind == TestRunProfileKind.Coverage) {
		cmd.push('-profile', res.cfg.ablunitConfig.profOptsUri.fsPath)
	} else if (res.cfg.requestKind == TestRunProfileKind.Debug) {
		cmd.push('-debugReady', res.cfg.ablunitConfig.command.debugPort.toString())
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

	for (const element of cmd) {
		cmdSanitized.push(element.replace(/\\/g, '/'))
	}

	log.info('ABLUnit Command: ' + cmdSanitized.join(' '))
	return cmdSanitized
}

function runCommand (res: ABLResults, options: TestRun, cancellation: CancellationToken) {
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
	const args = getCommand(res, options)

	const cmd = args[0]
	args.shift()

	let stdout = ''
	while (currentTestItems.length > 0) {
		currentTestItems.pop()
	}

	res.setStatus(RunStatus.Running)
	const runenv = getEnvVars(res.dlc.uri, res.cfg.ablunitConfig.command.debugConnectMaxWait)
	const compilerErrors: ICompilerError[] = []
	let timeout = res.cfg.ablunitConfig.timeout
	if (res.cfg.requestKind == TestRunProfileKind.Debug) {
		timeout = 0
	} else if (timeout < 0) {
		throw new RangeError('timeout ' + timeout + ' is invalid and must be greater than 0')
	}

	const spawnOpts: SpawnOptions = {
		signal: abort.signal,
		// killSignal: 'SIGTERM',
		// timeout: timeout,
		env: runenv,
		cwd: res.cfg.ablunitConfig.workspaceFolder.uri.fsPath,
		shell: true,
	}

	if (process.platform === 'win32') {
		spawnOpts.killSignal = 'SIGTERM'
		spawnOpts.timeout = timeout
	}

	log.info('command=\'' + cmd + ' ' + args.join(' ') + '\'\n\n', {testRun: options, testItem: currentTestItems[0] })
	const testRunDuration = new Duration('TestRun')
	const proc = spawn(cmd, args, spawnOpts)
	const openedgeErrorMessages: string[] = []

	return new Promise<string>((resolve, reject) => {
		let debuggerStarted = false

		proc.stderr?.on('data', (data: Buffer) => {
			log.debug('stderr')
			log.error('\t\t[stderr] ' + data.toString().trim().replace(/\n/g, '\n\t\t[stderr] '), {testRun: options, testItem: currentTestItems[0]})
		})
		proc.stdout?.on('data', (data: Buffer) => {
			log.debug('stdout')
			const lines = (stdout + data.toString()).replace('/\r/g', '').split('\n')
			if (lines[lines.length - 1] == '') {
				stdout = ''
				lines.pop()
				log.debug('pop blank line')
			} else {
				stdout = lines[lines.length - 1]
				lines.pop()
				log.debug('stdout savePartialLine=\'' + stdout + '\'')
			}

			for (const line of lines) {
				if (line.startsWith('ABLUNIT_STATUS=SERIALIZED_ERROR ')) {
					compilerErrors.push(JSON.parse(line.substring(32)) as ICompilerError)
					continue
				}
				if (line.startsWith('ABLUNIT_STATUS=')) {
					let ablunitStatus: IABLUnitStatus | undefined = undefined
					try {
						ablunitStatus = JSON.parse(line.substring(15)) as IABLUnitStatus
					} catch (e) {
						log.error('error parsing ablunitStatus: ' + e)
						continue
					}

					if (ablunitStatus.action == 'TEST_TREE' || ablunitStatus.entityName?.trim() == 'TEST_ROOT') {
						continue
					}
					if (ablunitStatus.entityName?.startsWith('TEST_ROOT ')) {
						continue
					}

					const prefix = ''
					switch (ablunitStatus.action) {
						case 'TEST_TREE':
						case 'COMPLETE':
							// nothing to do here
							break
						case 'TEST_START':
							setCurrentTestItem(ablunitStatus)
							options.started(currentTestItems[0])
							log.info(prefix + '🔹  ' + ablunitStatus.entityName, {testRun: options})
							break
						case 'TEST_END': {
							const dur = Number(ablunitStatus.duration ?? '0') * 1000
							options.passed(currentTestItems[0], dur)
							log.info(prefix + '✅  ' + ablunitStatus.entityName + ' (' + dur + ' ms)', {testRun: options})
							break
						}
						case 'TEST_FAIL':
							options.failed(currentTestItems[0], [])
							log.info(prefix + '❌  ' + ablunitStatus.entityName, {testRun: options})
							break
						case 'TEST_IGNORED':
							options.skipped(currentTestItems[0])
							log.info(prefix + '❔  ' + ablunitStatus.entityName, {testRun: options})
							break
						case 'TEST_EXCEPTION':
							options.failed(currentTestItems[0], [])
							log.info(prefix + '⚠️  ' + ablunitStatus.entityName, {testRun: options})
							break
						default:
							log.error('unknown ablunitStatus: ' + JSON.stringify(ablunitStatus))
							break
					}
					continue
				}

				if (line.startsWith('Use port ' + res.cfg.ablunitConfig.command.debugPort + ' for the Debugger to connect to.') && !debuggerStarted) {
					debuggerStarted = true

					debugLaunchProfile['port'] = res.cfg.ablunitConfig.command.debugPort
					debugLaunchProfile['hostname'] = res.cfg.ablunitConfig.command.debugHost
					log.info('debugLaunchProfile=' + JSON.stringify(debugLaunchProfile, null, 4))

					debug.startDebugging(res.cfg.ablunitConfig.workspaceFolder, debugLaunchProfile)
						.then((r) => {
							log.debug('r=' + r + ' activeDebugSession=' + (debug.activeDebugSession ? true : false))
							if (!debug.activeDebugSession) {
								throw new Error('activeDebugSession not found after starting debugger')
							}
							return r
						}, (e: unknown) => {
							log.error('Debugger failed to start, continuing with test execution (e=' + e + ')', {testRun: options})
						})
				}

				if (/^\*\* .* \(\d+\)/.exec(line)) {
					openedgeErrorMessages.push(line)
				}

				log.info(line, {testRun: options, testItem: currentTestItems[0]})
			}
			log.debug('stdout DONE')

		})

		proc.once('spawn', () => {
			log.debug('spawn')
			res.setStatus(RunStatus.Executing)
			log.info('----- ABLUnit Test Run Started -----', {testRun: options, testItem: currentTestItems[0] })
		}).on('disconnect', () => {
			log.debug('process.disconnect')
		}).on('error', (e: Error) => {
			log.debug('error type=' + typeof e + ' e.message=' + e.message +
				'\n\te=' + JSON.stringify(e, null, 2))
			res.setStatus(RunStatus.Error, 'e=' + e)
			log.error('----- ABLUnit Test Run Error -----', {testRun: options, testItem: currentTestItems[0] })
			if (e instanceof Error) {
				reject(e)
			}
		}).on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
			log.debug('exit code=' + code + '; signal=' + signal)
			testRunDuration.stop()
			if (signal == 'SIGTERM') {
				res.setStatus(RunStatus.Timeout, 'signal=' + signal)
				log.info('----- ABLUnit Test Run Timeout - ' + res.cfg.ablunitConfig.timeout + 'ms ----- ' + testRunDuration, {testRun: options, testItem: currentTestItems[0] })
				const e = new TimeoutError('ABLUnit process timeout', testRunDuration, res.cfg.ablunitConfig.timeout, cmd)
				reject(e)
				return e
			}

			if (code && code != 0) {
				if (compilerErrors.length > 0) {
					res.setStatus(RunStatus.Error, 'compilerErrors=' + compilerErrors.length)
					const e = new ABLCompilerError(compilerErrors, cmd)
					const msg = new TestMessage(compilerErrors[0].messages.map(m => m.message).join('\n'))
					if (currentTestItems.length > 0) {
						options.errored(currentTestItems[0], msg)
					} else {
						options.errored(allTests[0], msg)
					}
					for (const item of allTests) {
						options.skipped(item)
					}
					res.setStatus(e)
					log.info('----- ABLUnit Test Run Failed (exit_code=' + code + '; compilerErrors=' + compilerErrors.length + ') ----- ' + testRunDuration, {testRun: options, testItem: currentTestItems[0] })
					reject(e)
					return e
				}
				res.setStatus(RunStatus.Error, 'exit_code=' + code)
				log.info('----- ABLUnit Test Run Failed (exit_code=' + code + ') ----- ' + testRunDuration, {testRun: options, testItem: currentTestItems[0] })

				if (openedgeErrorMessages.length > 0) {
					for (let i=0; i < allTests.length; i++) {
						if (i ===0) {
							for (const openedgeErrorMessage of openedgeErrorMessages) {
								options.failed(allTests[i], new TestMessage(openedgeErrorMessage))
							}
						} else {
							options.skipped(allTests[i])
						}
					}
					const e = new ABLUnitRuntimeError('ABLUnit exit_code=' + code, openedgeErrorMessages.join('\n'), cmd)
					reject(e)
					return e
				}
				const e = new ABLUnitRuntimeError('ABLUnit exit_code=' + code, 'ABLUnit exit_code=' + code + '; signal=' + signal, cmd)
				reject(e)
				return e
			}

			if (proc.killed || signal) {
				res.setStatus(RunStatus.Killed, 'signal=' + signal)
				const e = new ABLUnitRuntimeError('ABLUnit process killed', 'exit_code=' + code + '; signal=' + signal, cmd)
				reject(e)
				return e
			}

			res.setStatus(RunStatus.Complete, 'success')
			resolve('success')
		}).on('close', (code: number | null, signal: NodeJS.Signals | null) => {
			log.debug('close code=' + code + ' signal=' + signal)
			if (code == 0) {
				log.info('----- ABLUnit Test Run Complete ----- ' + testRunDuration, {testRun: options})
			} else if (openedgeErrorMessages.length > 0 && proc.pid) {
				log.warn('killing process pid=' + proc.pid + ' after close code=' + code + ' signal=' + signal)
				treeKill(proc.pid, 'SIGTERM', (err) => {
						if (err) {
							log.warn('failed to kill process pid=' + proc.pid + ' err=' + err)
						}
					})
			}
		}).on('message', (m: Serializable, _h: SendHandle) => {
			log.debug('message m=' + JSON.stringify(m))
		})

		if (timeout > 0 && process.platform !== 'win32') {
			setTimeout(function () {
				if (proc.exitCode != null) {
					return
				}
				log.debug('timeout after ' + timeout + 'ms')
				if (proc.pid) {
					treeKill(proc.pid, 'SIGTERM', (err) => {
						if (err) {
							log.warn('failed to kill process pid=' + proc.pid + ' err=' + err)
						}
					})
				}
			}, timeout)
		}

	})
}

function setCurrentTestItem (ablunitStatus: IABLUnitStatus) {
	if (ablunitStatus.action == 'TEST_START' && ablunitStatus.entityName) {
		const parts = ablunitStatus.entityName?.split(' ')
		let t = allTests.find(test => test.label == parts[parts.length - 1])
				?? allTests.find(test => test.uri?.fsPath.replace(/\\/g, '/').endsWith(parts[parts.length - 1]))
		if (!t && parts.length > 1) {
			t = allTests.find(test => test.label == parts[parts.length - 2])
				?? allTests.find(test => test.uri?.fsPath.replace(/\\/g, '/').endsWith(parts[parts.length - 2]))
		}
		if (t) {
			currentTestItems.unshift(t)
			return
		}

		let msg = 'cannot find test item for \'' + JSON.stringify(ablunitStatus.entityName) + '\'.  available tests (count=' + allTests.length + '):'
		for (const test of allTests) {
			msg += '\n - ' + test.label + ' ' + test.uri?.fsPath
		}
		log.error(msg)
	} else {
		currentTestItems.shift()
	}
}

export function getEnvVars (dlcUri: Uri | undefined, maxWait = 30000) {
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
	runenv['ABLUNIT_TEST_RUNNER_DEBUG_MAX_WAIT'] = maxWait.toString()
	return runenv
}
