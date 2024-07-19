import { WorkspaceFolder, commands, extensions, workspace } from 'vscode'
import { Duration, activateExtension, enableExtensions, getDefaultDLC, getRcodeCount, installExtension, log, oeVersion, sleep2, updateConfig } from './testCommon'

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

export async function enableOpenedgeAblExtension (runtimes: IRuntime[]) {
	const extname = 'riversidesoftware.openedge-abl-lsp'
	await installExtension(extname)
	await activateExtension(extname)
	await setRuntimes(runtimes)
	return rebuildAblProject()
		.then(() => {
			log.info('update complete')
			return getRcodeCount()
		}).then((rcodeCount) => {
			log.info('rebuild complete! (rcodeCount=' + rcodeCount + ')')
			log.info('riversidesoftware.openedge-abl-lsp extension is enabled!')
			return true
		}, (e) => { throw e})
}

export function restartLangServer () {
	return commands.executeCommand('abl.restart.langserv').then(() => {
		log.info('abl.restart.langserv command complete')
		return waitForLangServerReady()
	}).then(() => {
		log.info('lang server is ready')
		return true
	}, (e) => {
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
		}, (err) => {
			log.error('abl.project.rebuild failed! err=' + err)
			return commands.executeCommand('abl.dumpFileStatus')
		}).then(() => {
			log.info('abl.dumpFileStatus complete')
			return true
		}, (e) => {
			log.error('abl.dumpFileStatus failed! e=' + e)
		})
}

export async function waitForLangServerReady () {
	const maxWait = 60
	const waitTime = new Duration()

	// now wait until it is ready
	let dumpSuccess = false
	for (let i = 0; i < maxWait; i++) {
		log.info('start abl.dumpLangServStatus (i=' + i + ')')
		dumpSuccess = await commands.executeCommand('abl.dumpLangServStatus').then(() => {
			return true
		}, (e) => {
			log.info('dumpLangServStatus e=' + e)
			return false
		})
		await sleep2(400)
		log.info('end abl.dumpLangServStatus:' + dumpSuccess + ', i=' + i + ' ' + waitTime + ' (dumpSuccess=' + dumpSuccess + ')')
		if (dumpSuccess) {
			break
		}
		await sleep2(500)
	}
	if (dumpSuccess) {
		log.info('lang server is ready ' + waitTime)
		return true
	}
	log.error('lang server is not ready! '  + waitTime)
	throw new Error('lang server is not ready!')
}

export async function setRuntimes (runtimes: IRuntime[] = []) {
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
		throw new Error('[setRuntimes] extension not installed: riversidesoftware.openedge-abl-lsp')
	}
	if (!ext.isActive) {
		throw new Error('[setRuntimes] extension not active: riversidesoftware.openedge-abl-lsp')
	}

	const conf = workspace.getConfiguration('abl')
	const current = conf.get('configuration.runtimes')!
	log.info('current=' + JSON.stringify(current))
	log.info('  input=' + JSON.stringify(runtimes))
	if (JSON.stringify(current) === JSON.stringify(runtimes)) {
		log.info('runtmes are already set ' + duration)
		return true
	}

	log.info('workspace.getConfiguration("abl").update("configuration.runtimes") - START')
	const r = await workspace.getConfiguration('abl').update('configuration.runtimes', runtimes, true)
		.then(() => {
			log.info('workspace.getConfiguration("abl").update(configuration.runtimes) - END')
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
