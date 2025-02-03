import { commands, extensions, LogLevel, Uri, workspace } from 'vscode'
import { Duration, activateExtension, enableExtensions, getDefaultDLC, getRcodeCount, getWorkspaceUri, installExtension, log, oeVersion, sleep2, FileUtils } from './testCommon'
import { getContentFromFilesystem } from 'parse/TestParserCommon'
import * as glob from 'glob'
import { dirname } from 'path'

let ablunitLogUri = getWorkspaceUri()

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export async function enableOpenedgeAblExtension (runtimes?: IRuntime[]) {
	const extname = 'riversidesoftware.openedge-abl-lsp'
	ablunitLogUri = await commands.executeCommand('_ablunit.getLogUri')

	if (!extensions.getExtension(extname)) {
		await installExtension(extname)
	}
	if (!extensions.getExtension(extname)?.isActive) {
		await activateExtension(extname)
	}
	await setRuntimes(runtimes)
		.then(() => rebuildAblProject())
		.then(() => {
			log.info('update complete')
			const rcodeCount = getRcodeCount()
			log.info('rebuild complete! (rcodeCount=' + rcodeCount + ')')
			log.info('riversidesoftware.openedge-abl-lsp extension is enabled!')
			return true
		}, (e: unknown) => { throw e })
}

export function restartLangServer () {
	log.info('restarting lang server with command abl.restart.langserv')
	return commands.executeCommand('abl.restart.langserv').then(() => {
		log.info('command abl.restart.langserv command completed successfully')
		return waitForLangServerReady()
	}).then(() => {
		log.info('lang server is ready')
		return true
	}, (e: unknown) => {
		log.error('abl.restart.langserv command failed! e=' + e)
	})
}

export function rebuildAblProject () {
	const confRuntimes = workspace.getConfiguration('abl').get('configuration.runtimes')!
	log.info('rebuilding abl project... runtimes=' + JSON.stringify(confRuntimes))

	return waitForLangServerReady()
		.then(() => { return commands.executeCommand('abl.project.rebuild') })
		.then(() => {
			const rcodeCount = getRcodeCount()
			log.info('abl.project.rebuild command complete! (rcodeCount=' + rcodeCount + ')')
			return rcodeCount
		}, (e: unknown) => {
			log.error('abl.project.resbuild command failed! e=' + e)
			throw e
		})
}

export async function printLastLangServerError () {
	const lines = await getLogContents()
	if (lines.length == 0) {
		throw new Error('ABL language server log file has no lines')
	}

	let lastLogErrors = ''
	let hasError = false
	for (let i = lines.length - 1; i >= 0; i--) {
		// read until we hit an error, then read until we don't see an error.
		if (lines[i].includes(' [ERROR] ')) {
			hasError = true
			lastLogErrors = String(i).padStart(8, ' ') + ': ' + lines[i] + '\n' + lastLogErrors
		} else if (hasError) {
			break
		}
	}
	log.info('Last logged ABL lang server error (lines.length=' + lines.length + '):\n"' + lastLogErrors + '"')
	return hasError
}

async function getLogContents () {
	log.debug('ablunitLogUri=' + ablunitLogUri.fsPath)
	const pattern = dirname(dirname(ablunitLogUri.fsPath)) + '/*/*/*-ABL Language Server.log'
	log.debug('glob pattern=' + pattern)

	const logFiles = glob.globSync(pattern, { absolute: true, nodir: true })
	log.debug('logFiles=' + JSON.stringify(logFiles, null, 2))

	if (logFiles.length <= 0) {
		log.warn('No log files found for ABL Language Server')
		return []
	}
	const uri = Uri.file(logFiles[logFiles.length - 1])
	log.debug('reading openedge-abl extension log (logFile.length=' + logFiles.length + '):\n\t"' + uri.fsPath + '"')
	return await getContentFromFilesystem(uri)
		.then((contents) => {
			contents = contents.replace(/\r/g, '')
			let lines = contents.split('\n')
			if (lines.length == 1 && lines[0] == '') {
				lines = []
			}
			log.debug('openedge-abl extension log lines.length=' + lines.length)
			return contents.split('\n')
		})
}

export async function waitForLangServerReady () {
	const maxWait = 15 // seconds
	const waitTime = new Duration()
	let langServerReady = false
	let langServerError = false
	let lastLogLength = 0

	while (!langServerReady && waitTime.elapsed() < maxWait * 1000) {
		const prom = getLogContents()
			.then((lines) => {
				if (lastLogLength > lines.length) {
					log.warn('log file for openedge-abl-lsp extension is smaller!  was length=' + lastLogLength + '; now length=' + lines.length)
					lastLogLength = 0
					return false
				}

				let startAtLine = 0
				if (lastLogLength != -1 && lastLogLength < lines.length) {
					startAtLine = lastLogLength
				}

				let langServerReady = false
				log.info('---------- lines written to openedge-abl extension log since last check ----------')
				for (let i=startAtLine; i<lines.length; i++) {
					log.info(i + ': ' + lines[i])

					// regex matching lines like "[<timestamp>] [<logLevel>] [<projectName] <message>"
					const lineDetail = /^(\[.*\]) (\[[A-Z]*\]) (\[.*\]) (.*)$/.exec(lines[i])

					if (lineDetail) {
						// log.info('lineDetail=' + JSON.stringify(lineDetail, null, 4))
						if (lineDetail[4] == 'Project shutdown completed' || lineDetail[4] == 'Start OE client process') {
							langServerReady = false
							langServerError = false
						} else if (lineDetail[4] == 'OpenEdge worker started') {
							langServerReady = true
							langServerError = false
						} else if (lineDetail[4].startsWith('### OE Client #0 ended with exit code')) {
							langServerReady = false
							langServerError = true
						}
					}
				}
				log.info('---------- ---------- ----------')
				lastLogLength = lines.length
				return langServerReady
			})

		langServerReady = await prom // await promise instead of awaiting in assignment so other threads can run
		if (langServerReady || langServerError) {
			break
		}

		const prom2 = sleep2(250, 'language server not ready yet... (waitTime=' + waitTime + ')')
		await prom2 // await prom so other threads can run
	}

	if (langServerReady) {
		try {
			const dumpSuccessProm = commands.executeCommand('abl.dumpLangServStatus')
			const ret = await dumpSuccessProm
			log.info('command abl.dumpLangServStatus complete (ret=' + ret + ')')
		} catch (e) {
			throw new Error('command abl.dumpLangServStatus failed! e=' + e)
		}

		log.info('lang server is ready (waitTime=' + waitTime + ')')
		return true
	}
	if (langServerError) {
		log.error('lang server has an error! (waitTime=' + waitTime + ')')

		const clientLogUri = FileUtils.toUri('.builder/clientlog0.log')
		if (!FileUtils.doesFileExist(clientLogUri)) {
			log.warn('client log file does not exist: ' + clientLogUri.fsPath)
		} else {
			const clientlogLines = FileUtils.readLinesFromFileSync(clientLogUri)
			if (clientlogLines.length == 0) {
				log.warn('client log file is empty: ' + clientLogUri.fsPath)
			} else {
				log.info('---------- ' + clientLogUri.fsPath + '-----------')
				for (let i=0; i<clientlogLines.length; i++) {
					log.info(i + ': ' + clientlogLines[i])
				}
				log.info('---------- ---------- ----------')
			}
		}

		const stdoutUri = FileUtils.toUri('.builder/stdout0.log')
		if (!FileUtils.doesFileExist(stdoutUri)) {
			log.warn('stdout file does not exist: ' + stdoutUri.fsPath)
		} else {
			const stdoutLines = FileUtils.readLinesFromFileSync(stdoutUri)
			if (stdoutLines.length == 0) {
				log.warn('stdout file is empty: ' + stdoutUri.fsPath)
			} else {
				log.info('---------- ' + stdoutUri.fsPath + '-----------')
				for (let i=0; i<stdoutLines.length; i++) {
					log.info(i + ': ' + stdoutLines[i])
				}
				log.info('---------- ---------- ----------')
			}
		}
		throw new Error('lang server failed to start! (waitTime=' + waitTime + ')')
	}

	if (log.getLogLevel() < LogLevel.Debug) {
		const lines = await getLogContents()
		log.info('---------- openedge-abl extension log ----------')
		for (let i=0; i<lines.length; i++) {
			log.info(i + ': ' + lines[i])
		}
		log.info('---------- ---------- ----------')
	}

	log.error('lang server is not ready! (waitTime='  + waitTime + ')')
	throw new Error('lang server is not ready! (waitTime='  + waitTime + ')')
}

export async function waitForRCode () {
	const maxWait = 15 // seconds
	const waitTime = new Duration()
	let dumpSuccess = false

	let lastLogLength = 0
	let compileSuccess = 0
	let compileFailed = 0
	let noChangeCount = 0


	while (!dumpSuccess && waitTime.elapsed() < maxWait * 1000) {

		const prom  = getLogContents()
			.then((lines) => {
				if (lastLogLength > lines.length) {
					log.warn('log file for openedge-abl-lsp extension is smaller!  was length=' + lastLogLength + '; now length=' + lines.length)
					lastLogLength = 0
					return false
				} else if (lastLogLength != -1 && lastLogLength < lines.length) {
					log.info('---------- lines written to openedge-abl extension log since last check ----------')
					for (let i=lastLogLength; i<lines.length; i++) {
						log.info(i + ': ' + lines[i])

						const lineDetail = /^(\[.*\]) (\[.*\]) (\[.*\]) (.*)$/.exec(lines[i])
						if (lineDetail && lineDetail.length == 5) {
							if (lineDetail[4] == 'Project shutdown completed') {
								compileFailed = 0
								compileSuccess = 0
							} else if (lineDetail[4].startsWith('Compilation failed: ')) {
								compileFailed++
							} else if (lineDetail[4].startsWith('Compilation successful: ')) {
								compileSuccess++
							}
						}
					}
					log.info('---------- ---------- ----------')
					lastLogLength = lines.length
					return false
				}
				const linesChanged = lines.length - lastLogLength
				lastLogLength = lines.length
				if (linesChanged == 0) {
					noChangeCount++
				}
				return noChangeCount > 3 && compileFailed + compileSuccess > 0
			})
		dumpSuccess = await prom
		if (dumpSuccess) {
			break
		}

		const prom2 = sleep2(250, 'language server not ready yet... (waitTime=' + waitTime + ', compileFailed=' + compileFailed + ', compileSuccess=' + compileSuccess + ')')
			.catch((e: unknown) => { throw e })
		await prom2
	}

	log.info('lang server compile stats:')
	log.info('  compile success = ' + compileSuccess)
	log.info('  compile failed  = ' + compileFailed)


	if (dumpSuccess) {
		log.info('lang server is ready ' + waitTime)
		return true
	}

	return await getLogContents()
		.then((lines) => {
			log.info('---------- openedge-abl extension log ----------')
			for (let i=0; i<lines.length; i++) {
				log.info(i + ': ' + lines[i])
			}
			log.info('---------- ---------- ----------')
			// return printLastLangServerError().then(() => {
			log.error('lang server is not ready! (waitTime='  + waitTime + ')')
			throw new Error('lang server is not ready! (waitTime='  + waitTime + ')')
		}, (e: unknown) => {
			throw e
		})
}

export function setRuntimes (runtimes?: IRuntime[]) {
	const duration = new Duration('setRuntimes')
	if (!enableExtensions()) {
		throw new Error('setRuntimes failed! extensions are disabled')
	}
	log.info('runtimes=' + JSON.stringify(runtimes))
	if (!runtimes) {
		runtimes = [{name: oeVersion(), path: getDefaultDLC(), default: true}]
	}
	log.info('setting abl.configuration.runtimes=' + JSON.stringify(runtimes))
	const ext = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
	if (!ext) {
		throw new Error('extension not installed: riversidesoftware.openedge-abl-lsp')
	}
	if (!ext.isActive) {
		throw new Error('extension not active: riversidesoftware.openedge-abl-lsp')
	}

	const conf = workspace.getConfiguration('abl')
	const current = conf.get('configuration.runtimes')!
	log.info('current=' + JSON.stringify(current))
	log.info('  input=' + JSON.stringify(runtimes))
	if (JSON.stringify(current) === JSON.stringify(runtimes)) {
		log.info('runtmes are already set ' + duration)
		return Promise.resolve(true)
		// return restartLangServer()
	}

	log.info('setting workspace configuration abl.configuration.defaultRuntime=' + oeVersion())
	const r =  conf.update('configuration.defaultRuntime', oeVersion(), true)
		.then(() => {
			log.info('workspace.getConfiguration("abl").update("configuration.runtimes") - START')
			return conf.update('configuration.runtimes', runtimes, true)
		})
		.then(() => {
			log.info('workspace.getConfiguration("abl").update(configuration.runtime) - END')
			return restartLangServer()
		})
		.then(() => {
			log.info('restartLangServer complete ' + duration)
			return true
		}, (e: unknown) => {
			if (e instanceof Error) {
				throw e
			}
			throw new Error('setRuntimes failed! e=' + e)
		})
	log.info('return r=' + JSON.stringify(r))
	return r
}
