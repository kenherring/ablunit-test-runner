import { commands, extensions, Uri, workspace } from 'vscode'
import { Duration, enableExtensions, getDefaultDLC, getRcodeCount, getWorkspaceUri, log, oeVersion, sleep, getSourceCount } from './testCommon'
import { getContentFromFilesystem } from 'parse/TestParserCommon'
import * as glob from 'glob'
import { dirname } from 'path'

let ablunitLogUri = getWorkspaceUri()

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

interface IAblExtProjectStatus {
	name: string
	initialized: boolean
	workers: number
	sourceTasks: number
	rcodeTasks: number
}

interface IAblExtStatus {
	projects: IAblExtProjectStatus[]
}

interface IAblExtExports {
	getProjectInfo: (projectUri: Uri) => Promise<unknown>
	getFileInfo: (uri: Uri) => Promise<unknown>
	getSchema: (projectUri: Uri) => Promise<unknown>
	status: () => Promise<IAblExtStatus>
	restartLanguageServer: () => Promise<void>
}

let ablExtExports: IAblExtExports | undefined = undefined

async function activateExtension () {
	const extname = 'riversidesoftware.openedge-abl-lsp'
	log.info('activating ' + extname + ' extension...')
	const ext = extensions.getExtension(extname)
	if (!ext) {
		throw new Error('cannot activate extension, not installed: ' + extname)
	}

	if (!ext.isActive) {
		await ext.activate().then(() => {
			log.info('activated ' + extname + ' extension!')
		}, (e: unknown) => { throw e })
	}
	if (extname === 'riversidesoftware.openedge-abl-lsp') {
		await waitForLangServerReady()
	}
	return ext.isActive
}

export async function enableOpenedgeAblExtension (runtimes?: IRuntime[], rcodeCount?: number) {
	const extname = 'riversidesoftware.openedge-abl-lsp'
	ablunitLogUri = await commands.executeCommand('_ablunit.getLogUri')

	if (!extensions.getExtension(extname)?.isActive) {
		await activateExtension()
	}
	await setRuntimes(runtimes)
		.then(() => waitForRcode(rcodeCount))
		.then((rcodeCount) => {
			log.info('rebuild complete! (rcodeCount=' + rcodeCount + ')')
			log.info('riversidesoftware.openedge-abl-lsp extension is enabled!')
			return true
		}, (e: unknown) => { throw e })
}

async function waitForRcode (expectedCount?: number) {
	const waitTime = new Duration()
	let rcodeCount = getRcodeCount()
	let lastRcodeCount = rcodeCount
	let rcodeDuration = new Duration ('rcodeDuration')
	expectedCount = expectedCount ?? getSourceCount() * .80
	while (rcodeCount < expectedCount) {

		if (lastRcodeCount != rcodeCount) {
			rcodeDuration = new Duration('rcodeDuration')
		} else if (rcodeCount > 0 && rcodeDuration.elapsed() > 5000) {
			log.warn('no new rcode generated for 5 seconds, assume we are done compiling')
			return rcodeCount
		}

		if (waitTime.elapsed() > 10000) {
			await sleep(1000, null)
		} else if (waitTime.elapsed() > 5000) {
			await sleep(500, null)
		} else {
			await sleep(100, null)
		}
		lastRcodeCount = rcodeCount
		rcodeCount = getRcodeCount()
	}
	log.info('rcodeCount=' + rcodeCount + ', expectedCount=' + expectedCount + ' ' + waitTime)
	return rcodeCount
}

function setAblExports () {
	if (!ablExtExports) {
		const ablExt = extensions.getExtension('riversidesoftware.openedge-abl-lsp')
		if (!ablExt) {
			throw new Error('extension not installed: riversidesoftware.openedge-abl-lsp')
		}
		ablExtExports = ablExt.exports as IAblExtExports
	}
	if (typeof ablExtExports.restartLanguageServer !== 'function') {
		throw new Error('ablExtExports.restartLanguageServer is not a function!!! typeof=' + typeof ablExtExports.restartLanguageServer)
	}
}

export async function restartLangServer (rcodeCount = 0): Promise<number> {
	setAblExports()

	const status = await ablExtExports!.status()
	log.info('status=' + JSON.stringify(status))

	return await ablExtExports!.restartLanguageServer()
		.then(() => waitForLangServerReady())
		.then(() => waitForRcode(rcodeCount))
}

export async function rebuildAblProject (waitForRcodeCount = 0) {
	log.info('rebuilding abl project...')
	const rebuildTime = new Duration('rebuildTime')
	let startingLine = (await getLogContents()).length
	let compileResults: { success: number, failure: number } = { success: 0, failure: 0 }

	await commands.executeCommand('abl.project.rebuild')

	let stillCompiling = true
	while (stillCompiling && rebuildTime.elapsed() < 15000) {
		const prom = sleep(100, 'waiting for project rebuild to complete... ' + rebuildTime)
			.then(() => { return getLogContents() })
		const lines = await prom
		// log.info('lines.length=' + lines.length)

		stillCompiling = false
		for (let i=startingLine; i<lines.length; i++) {
			const parts = /^\[([^\]]*)\] \[([A-Z]*)\] (\[[^\]]*\]*)? ?(.*)$/.exec(lines[i])
			let message: string | undefined = undefined
			if (parts) {
				if (parts.length >= 4) {
					message = parts[4]
				} else if (parts.length == 3) {
					message = parts[3]
				}
			}

			// log.info('lines[' + i + '] = "' + message + '"')
			if (message == 'Project rebuild triggered by client') {
				compileResults = { success: 0, failure: 0 }
				stillCompiling = true
			} else if (message?.startsWith('Compilation successful: ')) {
				compileResults.success++
				stillCompiling = true
			} else if (message?.startsWith('Compilation failed: ')) {
				compileResults.failure++
				stillCompiling = true
			}
		}
		startingLine = lines.length

		if (compileResults.success == 0 && compileResults.failure == 0) {
			stillCompiling = true
		}

		if (waitForRcodeCount > 0) {
			const rcodeCount = getRcodeCount()
			if (rcodeCount < waitForRcodeCount) {
				log.info('rcodeCount=' + rcodeCount + '; waiting for rcodeCount=' + waitForRcodeCount)
				stillCompiling = true
			}
			if (rcodeCount >= waitForRcodeCount) {
				log.info('rcodeCount=' + rcodeCount + '; rcodeCount >= waitForRcodeCount=' + waitForRcodeCount)
				stillCompiling = false
			}
		}
	}

	let rcodeCount = getRcodeCount()
	log.info('command abl.project.rebuild complete! rcodeCount=' + rcodeCount)
	if (rcodeCount == 0) {
		await sleep(100, 'waiting for rcode to be generated...')
		rcodeCount = getRcodeCount()
		log.info('rcodeCount=' + rcodeCount)
	}

	const status = await ablExtExports!.status()
	for (const project of status.projects) {
		if (project.rcodeTasks > 0 || project.sourceTasks > 0) {
			await sleep(100, 'rcode queue is ' + project.rcodeTasks + ', source queue is ' + project.sourceTasks)
		}
	}
	rcodeCount = getRcodeCount()
	log.info('rcodeCount=' + rcodeCount)
	return rcodeCount
}

async function getLogContents () {
	const pattern = dirname(dirname(ablunitLogUri.fsPath)) + '/*/*/*-ABL Language Server.log'

	const logFiles = glob.globSync(pattern, { absolute: true, nodir: true })

	if (logFiles.length <= 0) {
		log.warn('No log files found for ABL Language Server')
		return []
	}
	const uri = Uri.file(logFiles[logFiles.length - 1])
	return await getContentFromFilesystem(uri)
		.then((contents) => {
			contents = contents.replace(/\r/g, '')
			let lines = contents.split('\n')
			if (lines.length == 1 && lines[0] == '') {
				lines = []
			}
			log.debug('openedge-abl extension log lines.length=' + lines.length)
			return lines
		})
}

async function waitForLangServerReady () {
	const maxWait = 15 // seconds
	setAblExports()

	const waitTime = new Duration()
	let status = await ablExtExports!.status()
	while (waitTime.elapsed() < maxWait * 1000) {
		if (!status?.projects || status.projects.length === 0) {
			log.info('language server not ready yet...' +  waitTime)
			continue
		}

		let isReady = true
		for (const project of status.projects) {
			if (!project.initialized || project.rcodeTasks !== 0 || project.sourceTasks !== 0) {
				isReady = false
			}
		}
		if (isReady) {
			log.info('Language server is ready!')
			return
		}

		await sleep(250)
			.then(() => ablExtExports!.status())
			.then((response) => {
				status = response
			})
	}
	throw new Error('language server is not ready!  status=' + JSON.stringify(status))
}

export function setRuntimes (runtimes?: IRuntime[]) {
	const duration = new Duration('setRuntimes')
	if (!enableExtensions()) {
		throw new Error('setRuntimes failed! extensions are disabled')
	}
	// log.info('runtimes=' + JSON.stringify(runtimes))
	runtimes = runtimes ?? [{name: oeVersion(), path: getDefaultDLC(), default: true}]

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
	}

	const r =  conf.update('configuration.defaultRuntime', oeVersion(), true)
		.then(() => conf.update('configuration.runtimes', runtimes, true))
		.then(() => {
			log.info('restarting lang server after setRuntimes')
			return restartLangServer()
		})
		.then(() => {
			return true
		}, (e: unknown) => {
			if (e instanceof Error) {
				throw e
			}
			throw new Error('setRuntimes failed! e=' + e)
		})
	return r
}
