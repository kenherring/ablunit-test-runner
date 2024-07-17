import { globSync } from 'glob'
import { WorkspaceFolder, commands, extensions, workspace } from 'vscode'
import { Duration, activateExtension, enableExtensions, getDefaultDLC, installExtension, log, oeVersion, sleep2, updateConfig } from './testCommon'

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
	await rebuildAblProject()
	log.info('riversidesoftware.openedge-abl-lsp extension is enabled!')


	// const prom = setRuntimes(runtimes)
	const current = workspace.getConfiguration('abl').get('configuration.runtimes')
	log.info('current=' + JSON.stringify(current))
	log.info(' set to=' + JSON.stringify(runtimes))
	if (JSON.stringify(current) === JSON.stringify(runtimes)) {
		log.info('runtimes are already set')
		return
	}

	// log.info('workspace.getConfiguration(\'abl\').update(\'configuration.runtimes\')')
	// const prom = workspace.getConfiguration('abl').update('configuration.runtimes', JSON.stringify(runtimes), true)
	log.info('workspace.getConfiguration(\'abl.configuration\').update(\'runtimes\')')
	const prom = workspace.getConfiguration('abl.configuration').update('runtimes', JSON.stringify(runtimes), true)
		.then(() => {
			log.info('update complete')
			return getRcodeCount()
		})
		// .then(() => { return rebuildAblProject() })
		.then(() => {
			log.info('rebuild complete!')
			return true
		}, (e) => {
			log.error('failed to set runtimes (e=' + e + ')')
			throw e
		})
	log.info('await prom start')
	const r = await prom.then(() => {
		log.info('prom complete')
		return true
	}, (e) => { throw e })
	log.info('riversidesoftware.openedge-abl-lsp extension is enabled! (r=' + r + ')')
}

export function getRcodeCount (workspaceFolder?: WorkspaceFolder) {
	if (!workspaceFolder) {
		workspaceFolder = workspace.workspaceFolders?.[0]
	}
	if (!workspaceFolder) {
		throw new Error('workspaceFolder is undefined')
	}
	const g = globSync('**/*.r', { cwd: workspaceFolder?.uri.fsPath })
	const fileCount = g.length
	if (fileCount >= 0) {
		log.info('found ' + fileCount + ' r-code files')
		return fileCount
	}
	log.error('fileCount is not a number! fileCount=' + fileCount)
	return -1
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

// export async function waitForLangServerReady (preWaitTime: number | undefined = 10000) {
// const maxPreWait = preWaitTime / 100
// // wait until it is not ready
// for (let i=0; i<maxPreWait; i++) {
// 	const r = await commands.executeCommand('abl.dumpLangServStatus').then(() => {
// 		// log.info('abl.dumpLangServStatus preWait-ready i=' + i)
// 		return true
// 	}, (e) => {
// 		log.info('abl.dumpLangServStatus preWait not ready detected i=' + i + ', e=' + e)
// 		return false
// 	})
// 	if (!r) { break }
// 	await sleep2(100)
// }


export async function waitForLangServerReady () {
	const maxWait = 60
	const waitTime = new Duration()

	// now wait until it is ready
	const r = false
	for (let i = 0; i < maxWait; i++) {
		await commands.executeCommand('abl.dumpLangServStatus')
		log.info('sleep-400 start')
		await sleep2(400)
		log.info('sleep-400 end')
		log.info('abl.dumpLangServStatus: i=' + i + ' ' + waitTime + ' (r=' + r + ')')
		if (r) { break }
		log.info('sleep500-start')
		await sleep2(500)
		log.info('sleep500-end')
	}
	log.info('r=' + r)
	if (r) {
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
