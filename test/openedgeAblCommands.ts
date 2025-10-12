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

	// await ablExtExports!.status()
	// 	.then((status) => JSON.stringify('status=' + JSON.stringify(status, null, 4)))

	return await ablExtExports!.restartLanguageServer()
		.then(() => waitForLangServerReady())
		.then(() => waitForRcode(rcodeCount))
		// .then(() => ablExtExports!.status())
		// .then((status: unknown) => {
		// 	log.info('ablExtExports.status()=' + JSON.stringify(status, null, 4))
		// 	return waitForRcode(rcodeCount)
		// })
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
	const status = await dumpLangServStatus()
	if (status.projectStatus?.[0] && (status.projectStatus[0].rcodeQueue ?? -1) > 0) {
		await sleep(100, 'rcode queue is ' + status.projectStatus[0].rcodeQueue)
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
			return sleep(100, 'pause after command abl.dumpLangServStatus')
		}, (e: unknown) => {
			log.error('e=' + e)
			throw e
		})

	let lines = await getLogContents()
	// log.info('lines=' + JSON.stringify(lines, null, 4))

	const duration = new Duration('dumpLangServStatus')
	while (lines.length == startingLine && duration.elapsed() < 3000) {
		await sleep(100)
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
					langServStatus.projectStatus = langServStatus.projectStatus ?? []

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

		await sleep(500)
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
		.then(() => restartLangServer())
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
