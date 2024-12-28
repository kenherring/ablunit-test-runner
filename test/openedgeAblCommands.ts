import { commands, extensions, Uri, workspace } from 'vscode'
import { Duration, activateExtension, enableExtensions, getDefaultDLC, getRcodeCount, installExtension, log, oeVersion, sleep2 } from './testCommon'
import { getContentFromFilesystem } from 'parse/TestParserCommon'
import * as glob from 'glob'


interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export async function enableOpenedgeAblExtension (runtimes: IRuntime[] = []) {
	const extname = 'riversidesoftware.openedge-abl-lsp'

	log.info('runtimes=' + JSON.stringify(runtimes))

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
	return commands.executeCommand('abl.restart.langserv').then(() => {
		log.info('abl.restart.langserv command complete')
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
		}, (e: unknown) => { throw e })
}

export async function printLastLangServerError () {
	const ablunitLogUri: Uri = await commands.executeCommand('_ablunit.getLogUri')
	const logUri = Uri.joinPath(ablunitLogUri, '..', '..', '..', '..', '..', 'logs')

	const pattern = logUri.fsPath.replace(/\\/g, '/') + '/*/window*/exthost/output_logging_*/*-ABL Language Server.log'
	log.info('grep for log files using pattern: ' + pattern)
	const logFiles = glob.globSync(pattern)

	log.debug('logFiles=' + JSON.stringify(logFiles, null, 2))
	if (logFiles.length <= 0) {
		log.warn('No log files found for ABL Language Server')
		return false
	}
	const uri = Uri.file(logFiles[logFiles.length - 1])
	return getContentFromFilesystem(uri)
		.then((text) => {
			if (text === '') {
				throw new Error('ABL language server log file is empty (uri="' + uri.fsPath + '")')
			}
			const lines = text.split('\n')

			if (lines.length == 0) {
				throw new Error('ABL language server log file has no lines (uri="' + uri.fsPath + '")')
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
			log.info('Last logged ABL lang server error (uri="' + uri.fsPath + '"; lines.length=' + lines.length + '):\n"' + lastLogErrors + '"')
			return hasError
		}, (e: unknown) => {
			throw e
		})
}

export async function waitForLangServerReady () {
	const maxWait = 15
	const waitTime = new Duration()
	let dumpSuccess = false

	// now wait until it is ready
	for (let i = 0; i < maxWait; i++) {
		log.debug('start abl.dumpLangServStatus (i=' + i + ')')
		const dumpSuccessProm = commands.executeCommand('abl.dumpLangServStatus')
			.then(() => { return true
			}, (e: unknown) => {
				log.info('dumpLangServStatus e=' + e)
				return false
			})

		dumpSuccess = await dumpSuccessProm
		if (dumpSuccess) { break }
		await sleep2(250, 'language server not ready yet... (i=' + i + ' / ' + maxWait + ', dumpSuccess=' + dumpSuccess + ')')
			.then(() => { return printLastLangServerError() })
			.catch((e: unknown) => { throw e })
	}

	if (dumpSuccess) {
		log.info('lang server is ready ' + waitTime)
		return true
	}

	return printLastLangServerError()
		.then(() => {
			log.error('lang server is not ready! (waitTime='  + waitTime + ')')
			throw new Error('lang server is not ready! (waitTime='  + waitTime + ')')
		}, (e: unknown) => {
			throw e
		})
}

export function setRuntimes (runtimes: IRuntime[] = []) {
	const duration = new Duration('setRuntimes')
	if (!enableExtensions()) {
		throw new Error('setRuntimes failed! extensions are disabled')
	}
	log.info('runtimes=' + JSON.stringify(runtimes))
	if (!runtimes || runtimes.length == 0) {
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
		log.info('runtimes are already set ' + duration)
		return restartLangServer()
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
