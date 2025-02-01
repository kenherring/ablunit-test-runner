import { commands, extensions, Uri, workspace } from 'vscode'
import { Duration, activateExtension, enableExtensions, getDefaultDLC, getRcodeCount, getWorkspaceUri, installExtension, log, oeVersion, sleep2 } from './testCommon'
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
	return getLogContents()
		.then((lines) => {
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
		}, (e: unknown) => {
			throw e
		})
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
	log.info('reading openedge-abl extension log (logFile.length=' + logFiles.length + '):\n\t"' + uri.fsPath + '"')
	return getContentFromFilesystem(uri)
		.then((contents) => {
			contents = contents.replace(/\r/g, '')
			let lines = contents.split('\n')
			if (lines.length == 1 && lines[0] == '') {
				lines = []
			}
			log.info('openedge-abl extension log lines.length=' + lines.length)
			return contents.split('\n')
		})
}

export async function waitForLangServerReady () {
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
		const prom2 = sleep2(250, 'language server not ready yet... (waitTime=' + waitTime + ')')
			.catch((e: unknown) => { throw e })
		await prom2
	}



	// now wait until it is ready
	// let lastLogLength = -1
	// let compileFailed = 0
	// let compileSuccess = 0
	// let langServerStatus = 'not yet checked'
	// let i = 0
	// while (waitTime.elapsed() < maxWait * 1000) {
	// 	i++
	// 	log.info('start abl.dumpLangServStatus (i=' + i + ')')

	// 	let preDumpLogLength = 0

	// 	// format: "[<timestamp>] [<loglevel>] [<projectName>] <message>"
	// 	const logRegex = /^(\[.*\]) (\[.*\]) (\[.*\]) (.*)$/
	// 	// const logRegex = /^[^ ]* [^ ]* [^ ]* Project shutdown completed$/

	// 	const dumpSuccessProm = getLogContents()
	// 		.then((lines) => {
	// 			preDumpLogLength = lines.length
	// 			if (lastLogLength > preDumpLogLength) {
	// 				log.warn('log file for openedge-abl-lsp extension is smaller!  was length=' + lastLogLength + '; now length=' + preDumpLogLength)
	// 				langServerStatus = 'waiting for log file'
	// 				lastLogLength = -1
	// 			} else if (lastLogLength != -1 && lastLogLength < preDumpLogLength) {
	// 				log.info('---------- lines written to openedge-abl extension log since last check ----------')
	// 				for (let i=lastLogLength; i<preDumpLogLength; i++) {
	// 					// log.info(i + ': ' + lines[i])

	// 					const lineDetail = logRegex.exec(lines[i])
	// 					if (lineDetail && lineDetail.length == 5) {
	// 						if (lineDetail[4] == 'Project shutdown completed') {
	// 							compileFailed = 0
	// 							compileSuccess = 0
	// 						} else if (lineDetail[4].startsWith('Compilation failed: ')) {
	// 							compileFailed++
	// 						} else if (lineDetail[4].startsWith('Compilation successful: ')) {
	// 							compileSuccess++
	// 						}
	// 					}
	// 				}
	// 				log.info('---------- ---------- ----------')
	// 				langServerStatus = 'compiling'
	// 				lastLogLength = lines.length
	// 			}
	// 			return commands.executeCommand('abl.dumpLangServStatus')
	// 		}).then((r) => {
	// 			log.info('command abl.dumpLangServStatus completed successfully (r=' + r + ')')
	// 			return getLogContents()
	// 		}).then((lines) => {
	// 			lastLogLength = lines.length
	// 			if (lines.length == preDumpLogLength) {
	// 				langServerStatus = 'waiting for status dump'
	// 				return false
	// 			}

	// 			langServerStatus = 'reading status dump'
	// 			log.info('---------- new lines in openedge-abl extension log (lines.length=' + (lines.length - preDumpLogLength) + '; dumpSuccess=' + dumpSuccess + ' ----------')
	// 			for (let i=preDumpLogLength; i<lines.length; i++) {
	// 				// log.info(i + ': ' + lines[i])

	// 				const lineDetail = logRegex.exec(lines[i])
	// 				if (lineDetail && lineDetail.length == 5) {
	// 					if (lineDetail[4] == 'Project shutdown completed') {
	// 						compileFailed = 0
	// 						compileSuccess = 0
	// 						langServerStatus = 'Project shutdown completed'
	// 					} else if (lineDetail[4].startsWith('Compilation failed: ')) {
	// 						compileFailed++
	// 						langServerStatus = 'Compiling'
	// 					} else if (lineDetail[4].startsWith('Compilation successful: ')) {
	// 						compileSuccess++
	// 						langServerStatus = 'Compiling'
	// 					} else if (lineDetail[3].startsWith(' -> RCode queue size:')) {
	// 						langServerStatus = lineDetail[3].substring(4)
	// 					}
	// 				}
	// 			}
	// 			log.info('---------- ---------- ----------')

	// 			if (langServerStatus == 'dumping status' && compileFailed + compileSuccess > 0) {
	// 				langServerStatus = 'ready'
	// 				return true
	// 			}
	// 			log.info('abl.dumpLangServStatus completed successfully, but no compile messages found yet')
	// 			return false
	// 		}, (e: unknown) => {
	// 			log.info('dumpLangServStatus e=' + e)
	// 			return false
	// 		})

	// 	dumpSuccess = await dumpSuccessProm

	// 	if (dumpSuccess) { break }
	// 	const prom =  sleep2(250, 'language server not ready yet... (i=' + i + ', langServerStatus=' + langServerStatus + ')')
	// 		.catch((e: unknown) => { throw e })
	// 	await prom
	// }

	log.info('lang server compile stats:')
	log.info('  compile success = ' + compileSuccess)
	log.info('  compile failed  = ' + compileFailed)


	if (dumpSuccess) {
		log.info('lang server is ready ' + waitTime)
		return true
	}

	return getLogContents()
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
