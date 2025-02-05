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
		throw new Error('abl.restart.langserv command failed! e=' + e)
	})
}

export async function rebuildAblProject () {
	log.info('rebuilding abl project...')
	const rebuildTime = new Duration('rebuildTime')
	let startingLine = (await getLogContents()).length
	let compileResults: { success: number, failure: number } = { success: 0, failure: 0 }

	await commands.executeCommand('abl.project.rebuild')

	let stillCompiling = true
	while(!stillCompiling && compileResults.success == 0 && compileResults.failure == 0 && rebuildTime.elapsed() < 15000) {
		const prom = sleep2(250, 'waiting for project rebuild to complete... ' + rebuildTime)
			.then(() => { return getLogContents() })
		const lines = await prom
		if (lines.length == startingLine) {
			continue
		}
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

			if (message == 'Project rebuild triggered by client') {
				compileResults = { success: 0, failure: 0 }
			} else if (message?.startsWith('Compilation successful: ')) {
				compileResults.success++
				stillCompiling = true
			} else if (message?.startsWith('Compilation failed: ')) {
				compileResults.failure++
				stillCompiling = true
			}
		}
		startingLine = lines.length
		log.info('stillCompiling=' + stillCompiling + ', compileResults=' + JSON.stringify(compileResults))
		if (stillCompiling) {
			continue
		}
		if (compileResults.success > 0 || compileResults.failure > 0) {
			break
		}
	}

	let rcodeCount = getRcodeCount()
	log.info('command abl.project.rebuild complete! rcodeCount=' + rcodeCount)
	if (rcodeCount == 0) {
		await sleep2(250, 'waiting for rcode to be generated...')
		rcodeCount = getRcodeCount()
		log.info('rcodeCount=' + rcodeCount)
	}
	const status = await dumpLangServStatus()
	if (status.projectStatus?.[0] && (status.projectStatus[0].rcodeQueue ?? -1) > 0) {
		await sleep2(230, 'rcode queue is ' + status.projectStatus[0].rcodeQueue)
	}
	rcodeCount = getRcodeCount()
	log.info('rcodeCount=' + rcodeCount)
	return rcodeCount
}

interface ILangServStatus {
	numOeInstalls?: number			// Number of OE installs: 1
	installVersion?: string			// Install 12.8 : C:\Progress\OpenEdge-12.8
	installPath?: string
	// No registered CABL license
	uppercaseKeywords?: boolean 	// Uppercase keywords: false
	buildMode?: string				// Build mode: FULL_BUILD
	showIncludes?: boolean			// Show include files in outline: false
	showIncludeContent?: boolean		// Show content of include files in outline: false
	filesInMem?: number				// Text files in memory: 0 -- Parse units: 0
	parseUnits?: number
	numProjects?: number			// Number of projects: 1
	projectStatus?: [{				// Project proj0 0 -- Status
		name: string
		version: string
		rootDir?: string			//  -> Root directory: d:\ablunit-test-runner\test_projects\proj0
		numThreads?: number			//  -> Number of threads: 1 -- Active ABL sessions: 1 -- LS Workers: 1
		activeAblSessions?: number
		lsWorkers?: number
		sourceQueue?: number		//  -> SourceCode queue size: 0
		rcodeQueue?: number			//  -> RCode queue size: 5
		deployQueue?: number		//  -> Deployment queue size: 0
	}?]
}

async function dumpLangServStatus () {
	const startingLine = (await getLogContents()).length
	await commands.executeCommand('abl.dumpLangServStatus')
		.then(() => {
			return sleep2(250, 'pause after command abl.dumpLangServStatus')
		}, (e: unknown) => {
			log.error('e=' + e)
			throw e
		})

	let lines = await getLogContents()
	if (lines.length == startingLine) {
		await sleep2(252)
		lines = await getLogContents()
	}
	if (lines.length == startingLine) {
		throw new Error('No new lines in log after command abl.dumpLangServStatus (lines.length=' + lines.length + ')')
	}

	let langServStatus: ILangServStatus = {}

	for (let i=startingLine; i<lines.length; i++) {
		const parts = /^\[([^\]]*)\] \[([A-Z]*)\] (\[[^\]]\]*)? ?(.*)$/.exec(lines[i])
		if (parts && parts.length >= 3) {
			// const timestamp = parts[1]
			// const logLevel = parts[2]
			// const projectName = parts[3]
			const message = parts[4]

			// log.info('message = "' + message + '"')
			// log.info('parts=' + JSON.stringify(parts))
			if (message == '******** LANGUAGE SERVER STATUS ********') {
				langServStatus = {}
			} else if (message.startsWith('Number of OE installs:')) {
				// Number of OE installs: 1
				langServStatus.numOeInstalls = message.split(' ').pop() as unknown as number
			} else if (message.startsWith('Install ')) {
				// Install 12.8 : C:\Progress\OpenEdge-12.8
				const parts = /Install ([^ ]*) : (.*)/.exec(message)
				if (parts && parts.length >= 3) {
					langServStatus.installVersion = parts[1]
					langServStatus.installPath = parts[2]
				}
			// } else if (message == 'No registered CABL license') {
			} else if (message.startsWith('Uppercase keywords: ')) {
				// Uppercase keywords: false
				langServStatus.uppercaseKeywords = message.split(' ').pop() == 'true'
			} else if (message.startsWith('Build mode: ')) {
				// Build mode: FULL_BUILD
				langServStatus.buildMode = message.split(' ').pop()
			} else if (message.startsWith('Show include files in outline: ')) {
				// Show include files in outline: false
				langServStatus.showIncludes = message.split(' ').pop() == 'true'
			} else if (message.startsWith('Show content of include files in outline: ')) {
				// Show content of include files in outline: false
				langServStatus.showIncludeContent = message.split(' ').pop() == 'true'
			} else if (message.startsWith('Text files in memory: ')) {
				// Text files in memory: 0 -- Parse units: 0
				const parts = /Text files in memory: ([^ ]*) -- Parse units: (.*)/.exec(message)
				if (parts && parts.length >= 3) {
					langServStatus.filesInMem = parts[1] as unknown as number
					langServStatus.parseUnits = parts[2] as unknown as number
				}
			} else if (message.startsWith('Number of projects: ')) {
				// Number of projects: 1
				langServStatus.numProjects = message.split(' ').pop() as unknown as number
			} else if (message.startsWith('Project ')) {
				const parts = /Project ([^ ]*) ([^ ]*) -- Status/.exec(message)
				if (parts && parts.length >= 3) {
					if (!langServStatus.projectStatus) {
						langServStatus.projectStatus = []
					}
					langServStatus.projectStatus.push({
						name: parts[1],
						version: parts[2],
					})
				}
			} else if (message.startsWith('-> ')) {
				const idx = (langServStatus.projectStatus?.length ?? 0) - 1
				if (idx <= 0 && langServStatus.projectStatus?.[idx]) {
					if (message.startsWith('-> Root directory: ')) {
						langServStatus.projectStatus[idx].rootDir = message.split(' ').pop()
					} else if (message.startsWith('-> Number of threads: ')) {
						// -> Number of threads: 1 -- Active ABL sessions: 1 -- LS Workers: 1
						const parts = /-> Number of threads: ([^ ]*) -- Active ABL sessions: ([^ ]*) -- LS Workers: (.*)/.exec(message)
						if (parts && parts.length >= 4) {
							langServStatus.projectStatus[idx].numThreads = parts[1] as unknown as number
							langServStatus.projectStatus[idx].activeAblSessions = parts[2] as unknown as number
							langServStatus.projectStatus[idx].lsWorkers = parts[3] as unknown as number
						}
					} else if (message.startsWith('-> SourceCode queue size: ')) {
						langServStatus.projectStatus[idx].sourceQueue = message.split(' ').pop() as unknown as number
					} else if (message.startsWith('-> RCode queue size: ')) {
						langServStatus.projectStatus[idx].rcodeQueue = message.split(' ').pop() as unknown as number
					} else if (message.startsWith('-> Deployment queue size: ' + 0)) {
						langServStatus.projectStatus[idx].deployQueue = message.split(' ').pop() as unknown as number
					}
				}
			}
		}
	}
	log.info('langServStatus=' + JSON.stringify(langServStatus))
	return langServStatus
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

export async function waitForLangServerReady () {
	const maxWait = 15 // seconds // seconds
	const waitTime = new Duration()
	let langServerReady = false
	let langServerError = false
	let stillCompiling = true
	let compileSuccess = 0
	let compileFailed = 0
	let lastLogLength = 0

	while (!langServerReady || stillCompiling) {
		const lines = await sleep2(250)
			.then(() => getLogContents())
		if (!lines) {
			continue
		}

		if (lastLogLength > lines.length) {
			log.warn('log file for openedge-abl-lsp extension is smaller!  was length=' + lastLogLength + '; now length=' + lines.length)
			lastLogLength = 0 // nosonar
			return false
		}

		let startAtLine = 0
		if (lastLogLength != -1 && lastLogLength <= lines.length) {
			startAtLine = lastLogLength
		}

		stillCompiling = false
		for (let i=startAtLine; i<lines.length; i++) {

			// regex matching lines like "[<timestamp>] [<logLevel>] [<projectName] <message>"
			const parts = /^\[([^\]]*)\] \[([A-Z]*)\] (\[[^\]]*\]*)? ?(.*)$/.exec(lines[i])

			if (parts && parts.length >= 4 && parts[3]) {
				// log.info('parts=' + JSON.stringify(parts, null, 4))
				if (parts[4] == 'Project shutdown completed' || parts[4] == 'Start OE client process') {
					langServerReady = false
					langServerError = false
				} else if (parts[4] == 'Builder is already started' || parts[4].startsWith('OpenEdge worker started')) {
					langServerReady = true
					langServerError = false
				} else if (parts[4].startsWith('### OE Client #0 ended with exit code')) {
					langServerReady = false
					langServerError = true
				} else if (parts[4].startsWith('Compilation ')) {
					// langServerReady = false
					stillCompiling = true
					if (parts[4].startsWith('Compilation successful: ')) {
						compileSuccess++
					} else if (parts[4].startsWith('Compilation failed: ')) {
						compileFailed++
					}
				}
			}
		}
		lastLogLength = lines.length

		if (langServerReady) {
			const langServStatus = await dumpLangServStatus()
			if (!langServStatus.projectStatus?.[0] || (langServStatus.projectStatus?.[0]?.rcodeQueue ?? 1) > 0) {
				stillCompiling = true
			}
		}

		if (!stillCompiling && (langServerError || langServerReady)) {
			log.info('langServerReady=' + langServerReady + '; langServerError=' + langServerError)
			break
		}

		const prom2 = sleep2(250, 'language server not ready yet...' +  waitTime +
			'\n\tlangServerReady=' + langServerReady + ', langServerError=' + langServerError + ', compileSuccess=' + compileSuccess + ', compileFailed=' + compileFailed)
		await prom2 // await prom so other threads can run

		if (waitTime.elapsed() > maxWait * 1000) {
			log.info('timeout after ' + waitTime.elapsed() + 'ms')
			break
		}
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

	if (langServerReady) {
		log.error('lang server is ready! (waitTime='  + waitTime + ')')
		return true
	}

	log.error('lang server is not ready! (waitTime='  + waitTime + ')')
	throw new Error('lang server is not ready! (waitTime='  + waitTime + ')')
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
