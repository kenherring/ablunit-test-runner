import { CancellationError, CancellationToken, Uri, workspace } from 'vscode'
import { SendHandle, Serializable, SpawnOptions, spawn } from 'child_process'
import { log } from 'ChannelLogger'
import { ABLUnitConfig } from 'ABLUnitConfigWriter'
import { IDlc } from 'parse/OpenedgeProjectParser'
import { PropathParser } from 'ABLPropath'

let abort: AbortController

export async function ablExec (cfg: ABLUnitConfig, dlc: IDlc, execFile: string, propath: PropathParser, env: Record<string, string>, cancellation?: CancellationToken) {
	abort = new AbortController()

	cancellation?.onCancellationRequested(() => {
		log.debug('cancellation requested - ablunitRun')
		abort.abort()
		throw new CancellationError()
	})

	await runCommand(cfg, dlc, execFile, propath, env, cancellation)
		.then((r) => {
			log.info('runCommand complete (r=' + r + ')')
			return r
		}, (e: unknown) => {
			log.info('runCommand threw error! e=' + e)
			throw e
		})
}

function getCommand (cfg: ABLUnitConfig, dlc: IDlc, execFile: string, propath: PropathParser) {
	if (cfg.ablunitConfig.command.executable != '_progres' &&
		cfg.ablunitConfig.command.executable != 'prowin' &&
		cfg.ablunitConfig.command.executable != 'prowin32') {
		return getCustomCommand(cfg, dlc)
	}
	return getDefaultCommand(cfg, dlc, propath, execFile)
}

function getCustomCommand (cfg: ABLUnitConfig,  dlc: IDlc) {
	let cmd = cfg.ablunitConfig.command.executable.replace('${DLC}', dlc.uri.fsPath.replace(/\\/g, '/'))

	cmd = cmd.replace(/\$\{tempDir\}/, cfg.ablunitConfig.tempDirUri.fsPath)
	const cmdSanitized = cmd.split(' ')

	log.info('Command: ' + cmdSanitized.join(' '))
	return cmdSanitized
}

function getDefaultCommand (cfg: ABLUnitConfig, dlc: IDlc, propath: PropathParser, execFile: string) {
	if (!cfg.ablunitConfig.tempDirUri) {
		throw new Error('temp directory not set')
	}

	const executable = dlc.uri.fsPath.replace(/\\/g, '/') + '/bin/' + cfg.ablunitConfig.command.executable

	const cmd = [ executable, '-b', '-p', execFile ]

	if (process.platform === 'win32') {
		cfg.createProgressIni(propath.toString(), dlc)
		if (cfg.ablunitConfig.progressIniUri) {
			cmd.push('-basekey', 'INI', '-ininame', cfg.ablunitConfig.progressIniUri.fsPath)
		}
	} else if (process.platform === 'linux') {
		process.env['PROPATH'] = propath.toString()
	} else {
		throw new Error('unsupported platform: ' + process.platform)
	}

	cmd.push('-T', cfg.ablunitConfig.tempDirUri.fsPath)

	if (cfg.ablunitConfig.dbConnPfUri && cfg.ablunitConfig.dbConns && cfg.ablunitConfig.dbConns.length > 0) {
		cmd.push('-pf', cfg.ablunitConfig.dbConnPfUri.fsPath)
	}

	const cmdSanitized: string[] = []
	cmd.push(...cfg.ablunitConfig.command.additionalArgs)

	let params = ''
	if (cfg.ablunitConfig.dbAliases.length > 0) {
		params = 'ALIASES=' + cfg.ablunitConfig.dbAliases.join(';')
	}
	cmd.push('-param', '"' + params + '"')

	for (const element of cmd) {
		cmdSanitized.push(element.replace(/\\/g, '/'))
	}

	log.info('Command: ' + cmdSanitized.join(' '))
	return cmdSanitized
}

function runCommand (cfg: ABLUnitConfig, dlc: IDlc, execFile: string, propath: PropathParser, env: Record<string, string>, cancellation?: CancellationToken) {

	log.debug('command dir=\'' + cfg.ablunitConfig.workspaceFolder.uri.fsPath + '\'')
	if (cancellation?.isCancellationRequested) {
		log.info('cancellation requested - runCommand')
		throw new CancellationError()
	}
	const args = getCommand(cfg, dlc, execFile, propath)

	const cmd = args[0]
	args.shift()

	const runenv = getEnvVars(dlc.uri, env)

	const spawnOpts: SpawnOptions = {
		signal: abort.signal,
		// killSignal: 'SIGTERM',
		// timeout: timeout,
		env: runenv,
		cwd: cfg.ablunitConfig.workspaceFolder.uri.fsPath,
		shell: true,
	}

	log.info('command=\'' + cmd + ' ' + args.join(' '))
	const proc = spawn(cmd, args, spawnOpts)

	return new Promise<string>((resolve, reject) => {
		proc.stderr?.on('data', (data: Buffer) => {
			log.debug('stderr')
			log.error('\t\t[stderr] ' + data.toString().trim().replace(/\n/g, '\n\t\t[stderr] '))
		})
		proc.stdout?.on('data', (data: Buffer) => {
			log.debug('stdout data=' + data.toString().trim())
		})
		proc.once('spawn', () => {
			log.debug('spawn')
		}).on('disconnect', () => {
			log.debug('process.disconnect')
		}).on('error', (e: Error) => {
			log.debug('error type=' + typeof e + ' e.message=' + e.message +
				'\n\te=' + JSON.stringify(e, null, 2))
			log.error('Error generating debug listing: ' + e)
			if (e instanceof Error) {
				reject(e)
			}
		}).on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
			log.debug('exit code=' + code + '; signal=' + signal)
			if (code != 0) {
				throw new Error('Failed to execute ABL code (exit_code=' + code + ')')
			}
			resolve('success')
		}).on('close', (code: number | null, signal: NodeJS.Signals | null) => {
			log.debug('close code=' + code + ' signal=' + signal)
		}).on('message', (m: Serializable, _h: SendHandle) => {
			log.debug('message m=' + JSON.stringify(m))
		})
	})
}

export function getEnvVars (dlcUri: Uri | undefined, env: Record<string, string>) {
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
	runenv['SOURCE_FILE'] = env['SOURCE_FILE']
	runenv['DEBUG_LISTING_PATH'] = env['DEBUG_LISTING_PATH']
	return runenv
}
