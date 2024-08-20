import { readFileSync } from 'fs'
import {
	CancellationError,
	CancellationToken, ConfigurationChangeEvent, Disposable, ExtensionContext,
	ExtensionMode,
	FileCoverage,
	FileCoverageDetail,
	FileType,
	LogLevel,
	Position, Range, RelativePattern, Selection,
	TestController, TestItem, TestItemCollection, TestMessage,
	TestRun,
	TestRunProfileKind, TestRunRequest,
	TestTag,
	TextDocument, Uri, WorkspaceFolder,
	commands,
	extensions,
	tests, window, workspace
} from 'vscode'
import { ABLResults } from './ABLResults'
import { log } from './ChannelLogger'
import { getContentFromFilesystem } from './parse/TestParserCommon'
import { ABLTestCase, ABLTestClass, ABLTestData, ABLTestDir, ABLTestFile, ABLTestProgram, ABLTestSuite, resultData, testData } from './testTree'
import { minimatch } from 'minimatch'

export interface IExtensionTestReferences {
	testController: TestController
	recentResults: ABLResults[]
	currentRunData: ABLResults[]
}

let recentResults: ABLResults[] = []

export async function activate (context: ExtensionContext) {
	const ctrl = tests.createTestController('ablunitTestController', 'ABLUnit Test')
	let currentTestRun: TestRun | undefined = undefined
	let isRefreshTestsComplete = false
	let runWithCoverage = false

	logActivationEvent(context.extensionMode)

	const contextStorageUri = context.storageUri ?? Uri.file(process.env['TEMP'] ?? '') // will always be defined as context.storageUri
	const contextResourcesUri = Uri.joinPath(context.extensionUri, 'resources')
	setContextPaths(contextStorageUri, contextResourcesUri)
	await createDir(contextStorageUri)
	// const decorationProvider = new DecorationProvider()

	log.info('ABLUNIT_TEST_RUNNER_UNIT_TESTING=' + process.env['ABLUNIT_TEST_RUNNER_UNIT_TESTING'])
	if (process.env['ABLUNIT_TEST_RUNNER_UNIT_TESTING'] === 'true') {
		log.debug('add _ablunit.getExtensionTestReferences command')
		context.subscriptions.push(commands.registerCommand('_ablunit.getExtensionTestReferences', () => { return getExtensionTestReferences() }))
		log.debug('add _ablunit.isRefreshTestsComplete command')
		context.subscriptions.push(commands.registerCommand('_ablunit.isRefreshTestsComplete', () => { return isRefreshTestsComplete }))
	}
	log.info('ABLUnit Test Controller created')

	context.subscriptions.push(ctrl)

	context.subscriptions.push(
		commands.registerCommand('_ablunit.openCallStackItem', openCallStackItem),
		workspace.onDidChangeConfiguration(e => { updateConfiguration(e) }),

		workspace.onDidOpenTextDocument(e => {
			return new Disposable(async () => {
				await updateNodeForDocument(e, 'didOpen').then(() => {
					log.trace('updateNodeForDocument complete for ' + e.uri)
					return
				}, (e: unknown) => {
					log.error('failed updateNodeForDocument onDidTextDocument! err=' + e)
				})
			})
		})
		// watcher.onDidCreate(uri => { createOrUpdateFile(controller, uri) })
		// watcher.onDidChange(uri => { createOrUpdateFile(controller, uri) })
		// watcher.onDidDelete(uri => { controller.items.delete(uri.fsPath) })
	)

	const getExtensionTestReferences = () => {
		let data: ABLResults[] = []
		if (currentTestRun) {
			data = resultData.get(currentTestRun) ?? []
		}
		const ret = {
			testController: ctrl,
			recentResults: recentResults,
			currentRunData: data
		} as IExtensionTestReferences
		log.debug('_ablunit.getExtensionTestReferences currentRunData.length=' + ret.currentRunData?.length + ', recentResults.length=' + ret.recentResults?.length)
		return ret
	}

	const runHandler = (request: TestRunRequest, token: CancellationToken): Promise<void> => {
		if (request.continuous) {
			log.error('continuous test runs not implemented')
			throw new Error('continuous test runs not implemented')
		}
		return startTestRun(request, token).then(() => { return }, (e) => { throw e })
	}

	const runHandlerRun = (request: TestRunRequest, token: CancellationToken): Promise<void> => {
		runWithCoverage = false
		return runHandler(request, token)
	}

	const runHandlerCoverage = (request: TestRunRequest, token: CancellationToken): Promise<void> => {
		runWithCoverage = true
		return runHandler(request, token)
	}

	const loadDetailedCoverage = (testRun: TestRun, fileCoverage: FileCoverage, token: CancellationToken): Thenable<FileCoverageDetail[]> => {
		log.info('loadDetailedCoverage uri=' + fileCoverage.uri.fsPath + ', testRun=' + testRun.name)
		const d = resultData.get(testRun)
		const det: FileCoverageDetail[] = []

		if (d) {
			d.flatMap((r) => {
				const rec = r.coverage.get(fileCoverage.uri.fsPath)
				if (rec) {
					det.push(...rec)
				}
			})
		}
		return Promise.resolve(det)
	}

	async function openTestRunConfig () {
		let workspaceFolder: WorkspaceFolder
		if (workspace.workspaceFolders?.length === 1) {
			workspaceFolder = workspace.workspaceFolders[0]
		} else {
			// TODO - implement multi-folder workspace configuration
			throw new Error('configureHandler not implemented for multi-folder workspaces')
		}


		const uri = Uri.joinPath(workspaceFolder.uri, '.vscode', 'ablunit-test-profile.json')
		const det = Uri.joinPath(context.extensionUri, 'resources', 'ablunit-test-profile.detail.jsonc')
		const dir = Uri.joinPath(workspaceFolder.uri, '.vscode')

		const exists = await doesFileExist(uri)
		if (!exists) {
			await createDir(dir)
			await workspace.fs.copy(det, uri, { overwrite: false })
			log.info('successfully created .vscode/ablunit-test-profile.json')
		}

		return window.showTextDocument(Uri.joinPath(workspaceFolder.uri, '.vscode', 'ablunit-test-profile.json')).then(() => {
			log.info('Opened .vscode/ablunit-test-profile.json')
			return
		}, (err) => {
			log.error('Failed to open .vscode/ablunit-test-profile.json! err=' + err)
			return
		})
	}

	const startTestRun = (request: TestRunRequest, cancellation: CancellationToken) => {
		recentResults = []

		const discoverTests = async (tests: Iterable<TestItem>) => {
			for (const test of tests) {
				if (run.token.isCancellationRequested) {
					return
				}
				if (request.exclude?.includes(test)) {
					continue
				}

				const data = testData.get(test)

				if (data instanceof ABLTestFile || data instanceof ABLTestCase) {
					run.enqueued(test)
					queue.push({ test, data })

					for(const [,childTest] of test.children) {
						run.enqueued(childTest)
					}

				} else {
					await discoverTests(gatherTestItems(test.children))
				}
			}
		}

		const runTestQueue = async (res: ABLResults[]) => {
			for (const { test } of queue) {
				if (run.token.isCancellationRequested) {
					log.debug('cancellation requested - runTestQueue-1')
					throw new CancellationError()
				}
				run.started(test)
				for(const childTest of gatherTestItems(test.children)) {
					run.started(childTest)
				}
			}

			log.info('starting ablunit run')

			let ret = false
			for (const r of res) {
				r.setTestData(testData.getMap())
				if (res.length > 1) {
					log.info('starting ablunit tests for folder: ' + r.workspaceFolder.uri.fsPath, run)
				}

				ret = await r.run(run).then(() => {
					log.debug('r.run() successful')
					return true
				}, (e) => {
					log.error('ablunit run failed parsing results with exception: ' + e, run)
					throw e
				})
				if (!ret) {
					continue
				}

				if (r.ablResults) {
					const p = r.ablResults.resultsJson[0]
					const totals = 'Totals - '
								+ p.tests + ' tests, '
								+ p.passed + ' passed, '
								+ p.errors + ' errors, '
								+ p.failures + ' failures, '
								+ r.duration
					log.info(totals, run)
				} else {
					log.debug('cannot print totals - missing ablResults object')
				}

				for (const { test } of queue) {
					if (workspace.getWorkspaceFolder(test.uri!) === r.workspaceFolder) {
						if (run.token.isCancellationRequested) {
							log.debug('cancellation requested - runTestQueue-2')
							throw new CancellationError()
						} else {
							await r.assignTestResults(test, run)
						}
					}
				}
			}

			if(!ret) {
				for (const { test } of queue) {
					run.errored(test, new TestMessage('ablunit run failed'))
					for (const childTest of gatherTestItems(test.children)) {
						run.errored(childTest, new TestMessage('ablunit run failed'))
					}
				}
				run.end()
				return
			}

			log.debug('ablunit test run complete', run)

			if (run.token.isCancellationRequested) {
				log.debug('cancellation requested - test run complete')
				throw new CancellationError()
			}

			const data = resultData.get(run) ?? []
			log.info('setting recentResults (data.length=' + data.length + ')')
			log.debug('setting recentResults (data.length=' + data.length + ')')
			recentResults = data

			log.info('request.profile=' + request.profile)

			if (runWithCoverage && data.length > 0) {
				for (const res of data) {
					res.filecoverage.forEach((c) => {
						run.addCoverage(c)
					})
				}
			}

			void log.notification('ablunit tests complete')
			run.end()
			void log.notification('ablunit tests complete')
			return
		}

		const createABLResults = async () => {
			const res: ABLResults[] = []

			for(const itemData of queue) {
				if (run.token.isCancellationRequested) {
					return
				}
				const wf = workspace.getWorkspaceFolder(itemData.test.uri!)

				if (!wf) {
					log.error('Skipping test run for test item with no workspace folder: ' + itemData.test.uri!.fsPath)
					continue
				}
				let r = res.find(r => r.workspaceFolder === wf)
				if (!r) {
					r = new ABLResults(wf, await getStorageUri(wf), contextStorageUri, contextResourcesUri, cancellation)
					cancellation.onCancellationRequested(() => {
						log.debug('cancellation requested - createABLResults-1')
						r?.dispose()
						throw new CancellationError()
					})
					await r.start()
					res.push(r)
				}
				await r.addTest(itemData.test, run)
				// proms.push(r.addTest(itemData.test, run))
			}

			resultData.set(run, res)
			log.debug('all tests added to test run results object, preparing test run ' + res[0].duration.toString())
			return res
		}

		void log.notification('running ablunit tests')
		const queue: { test: TestItem; data: ABLTestData }[] = []
		const run = ctrl.createTestRun(request)
		currentTestRun = run
		cancellation.onCancellationRequested(() => {
			log.debug('cancellation requested - createABLResults-2')
			run.end()
			log.trace('run.end()')
			throw new CancellationError()
		})
		const tests = request.include ?? gatherTestItems(ctrl.items)

		return discoverTests(tests)
			.then(() => { return createABLResults() })
			.then((res) => {
				if (!res) {
					throw new Error('createABLResults failed')
				}
				checkCancellationRequested(run)
				return runTestQueue(res)
			})
			.then(() => {
				log.debug('runTestQueue complete')
				return
			}, (err: unknown) => {
				run.end()
				if (err instanceof CancellationError) {
					log.error('ablunit run failed with exception: CancellationError')
				} else if (err instanceof Error) {
					log.error('ablunit run failed with error: ' + err.message + ' - ' + err.stack)
				} else {
					log.error('ablunit run failed with non-error: ' + err)
				}
				throw err
			})
	}

	function updateNodeForDocument (e: TextDocument | TestItem | Uri, r: string) {
		log.info('r=' + r)
		let u: Uri | undefined
		if (e instanceof Uri) {
			u = e
		} else if (e.uri) {
			u = e.uri
		}
		if (!u) {
			throw new Error('updateNodeForDocument called with undefined uri')
		}
		if (workspace.getWorkspaceFolder(u) === undefined) {
			log.info('skipping updateNodeForDocument for file not in workspace: ' + u.fsPath)
			return Promise.resolve()
		}
		return updateNode(u, ctrl)
	}

	function resolveHandlerFunc (item: TestItem | undefined) {
		if (!item) {
			log.debug('resolveHandlerFunc called with undefined item - refresh tests?')
			if (workspace.getConfiguration('ablunit').get('discoverAllTestsOnActivate', false)) {
				log.debug('discoverAllTestsOnActivate is true. refreshing test tree...')
				return commands.executeCommand('testing.refreshTests').then(() => {
					log.trace('tests tree successfully refreshed on workspace startup')
					return
				}, (err) => {
					log.error('failed to refresh test tree. err=' + err)
				})
			}
			return Promise.resolve()
		}

		if (item.uri) {
			return updateNodeForDocument(item, 'resolve').then(() => {
				return
			})
		}

		const data = testData.get(item)
		if (data instanceof ABLTestFile) {
			return data.updateFromDisk(ctrl, item).then(() => { return }, (err) => { throw err })
		}
		return Promise.resolve()
	}

	ctrl.refreshHandler = async (token: CancellationToken) => {
		log.info('ctrl.refreshHandler start')
		isRefreshTestsComplete = false
		const prom = refreshTestTree(ctrl, token)
			.then((r) => {
				log.info('ctrl.refreshHandler post-refreshTestTree')
				return r
			})
			.catch((e: unknown) => { throw e })
		log.info('ctrl.refreshHandler await prom')
		const r = await prom.then((r) => { return r }, (e) => { throw e })
		log.info('ctrl.refreshHandler return (r=' + r + ')')
		isRefreshTestsComplete = true
		return

		// await prom
		// await prom.then()
		// const r = await prom.then(() => { log.info('ctrl.refreshHandler prom.then'); return true }, (e: unknown) => { throw unknownToError(e) })
		// log.info('ctrl.refreshHandler prom resolved (r=' + r + ')')
		// return
		// return refreshTestTree(ctrl, token).then(() => {
		// 	log.info('refresh tests complete!')
		// 	return
		// }, (err: unknown) => {
		// 	log.error('refresh tests failed. err=' + err)
		// 	throw err
		// })
	}

	ctrl.resolveHandler = item => {
		log.info('ctrl.resolveHandler')
		return resolveHandlerFunc(item)
	}

	function updateConfiguration (event: ConfigurationChangeEvent) {
		if (!event.affectsConfiguration('ablunit')) {
			log.warn('configuration updated but does not include ablunit settings (event=' + JSON.stringify(event) + ')')
		} else {
			log.debug('effects ablunit.file? ' + event.affectsConfiguration('ablunit.files'))
			if (event.affectsConfiguration('ablunit.files')) {
				removeExcludedFiles(ctrl, getExcludePatterns())
			}
		}
	}

	const configHandler = () => {
		log.info('testRunProfiler.configureHandler')
		openTestRunConfig().catch((err: unknown) => {
			log.error('Failed to open \'.vscode/ablunit-test-profile.json\'. err=' + err)
		})
	}

	const testProfileRun = ctrl.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandlerRun, true, new TestTag('runnable'), false)
	// const testProfileDebug = ctrl.createRunProfile('Debug Tests', TestRunProfileKind.Debug, runHandler, false, new TestTag('runnable'), false)
	const testProfileCoverage = ctrl.createRunProfile('Run Tests w/ Coverage', TestRunProfileKind.Coverage, runHandlerCoverage, true, new TestTag('runnable'), false)
	// const testProfileDebugCoverage = ctrl.createRunProfile('Debug Tests w/ Coverage', TestRunProfileKind.Coverage, runHandler, false, new TestTag('runnable'), false)
	testProfileRun.configureHandler = configHandler
	// testProfileDebug.configureHandler = configHandlerDebug
	testProfileCoverage.configureHandler = configHandler
	testProfileCoverage.loadDetailedCoverage = loadDetailedCoverage
	// testProfileDebugCoverage.configureHandler = configHandler

	if(workspace.getConfiguration('ablunit').get('discoverAllTestsOnActivate', false)) {
		await commands.executeCommand('testing.refreshTests')
	}
}

let contextStorageUri: Uri
let contextResourcesUri: Uri

function updateNode (uri: Uri, ctrl: TestController) {
	log.trace('updateNode uri=' + uri.fsPath)
	if(uri.scheme !== 'file' || isFileExcluded(uri, getExcludePatterns())) { return new Promise(() => { return false }) }

	const { item, data } = getOrCreateFile(ctrl, uri)
	if(!item || !data) {
		return new Promise(() => { return false })
	}

	ctrl.invalidateTestResults(item)
	return getContentFromFilesystem(uri).then((contents) => {
		return data.updateFromContents(ctrl, contents, item)
	})
}

export function setContextPaths (storageUri: Uri, resourcesUri: Uri) {
	contextStorageUri = storageUri
	contextResourcesUri = resourcesUri
}

export function getContextStorageUri () {
	return contextStorageUri
}

export function getContextResourcesUri () {
	return contextResourcesUri
}

export function checkCancellationRequested (run: TestRun) {
	if (run.token.isCancellationRequested) {
		log.debug('cancellation requested - chcekCancellationRequested')
		run.end()
		throw new CancellationError()
	}
}

async function getStorageUri (workspaceFolder: WorkspaceFolder) {
	if (!getContextStorageUri) { throw new Error('contextStorageUri is undefined') }

	const dirs = workspaceFolder.uri.path.split('/')
	const ret = Uri.joinPath(getContextStorageUri(), dirs[dirs.length - 1])
	await createDir(ret)
	return ret
}

function getExistingTestItem (controller: TestController, uri: Uri) {
	const items = gatherAllTestItems(controller.items)
	const existUri = items.find(item => item.id === uri.fsPath)
	if (existUri) {
		return existUri
	}

	return undefined
}

function getOrCreateFile (controller: TestController, uri: Uri, excludePatterns?: RelativePattern[]) {
	const existing = getExistingTestItem(controller, uri)

	if (excludePatterns && excludePatterns.length > 0 && isFileExcluded(uri, excludePatterns)) {
		if (existing) {
			deleteTest(controller, existing)
		}
		return { item: undefined, data: undefined }
	}

	if (existing) {
		const data = testData.get(existing)
		if (!data) {
			log.debug('data not found for existing item. file=' + workspace.asRelativePath(uri) + ', existing.id=' + existing.id)
			throw new Error('data not found for existing item. file=' + workspace.asRelativePath(uri) + ', existing.id=' + existing.id)
		}
		if (data instanceof ABLTestFile) {
			return { item: existing, data: data }
		} else {
			log.debug('unexpected data type for existing item. file=' + workspace.asRelativePath(uri) + ', existing.id=' + existing.id)
			throw new Error('unexpected data type.' +
								' file=' + workspace.asRelativePath(uri) +
								', existing.id=' + existing.id +
								', data.description=' + data.description)
		}
	}

	const data = createFileNode(uri)
	if(!data) {
		log.trace('No tests found in file: ' +workspace.asRelativePath(uri))
		return { item: undefined, data: undefined }
	}
	const file = controller.createTestItem(uri.fsPath, workspace.asRelativePath(uri.fsPath), uri)
	testData.set(file, data)
	data.didResolve = false
	file.description = 'To be parsed...'
	file.tags = [ new TestTag('runnable') ]

	const parent = getOrCreateDirNodeForFile(controller, uri, data instanceof ABLTestSuite)
	if (parent) {
		parent.children.add(file)
	} else {
		controller.items.add(file)
	}

	file.canResolveChildren = true
	return { item: file, data: data }
}

function getWorkspaceFolderNode (controller: TestController, workspaceFolder: WorkspaceFolder) {
	const wfNode = controller.items.get(workspaceFolder.uri.fsPath)
	if(wfNode) {
		return wfNode
	}

	const wf = controller.createTestItem(workspaceFolder.uri.fsPath, workspaceFolder.name, workspaceFolder.uri)
	wf.canResolveChildren = false
	wf.description = 'WorkspaceFolder'
	wf.tags = [ new TestTag('runnable'), new TestTag('ABLTestDir') ]
	controller.items.add(wf)

	testData.set(wf, new ABLTestDir('WorkspaceFolder', workspaceFolder.name, workspaceFolder.uri))
	return wf
}

function getTestSuiteNode (controller: TestController, workspaceFolder: WorkspaceFolder, parent: TestItem | undefined) {
	const groupId = (parent?.id ?? workspaceFolder.uri.fsPath) + '#ABLTestSuiteGroup'

	let siblings: TestItemCollection
	if(parent) {
		siblings = parent.children
	} else {
		siblings = controller.items
	}
	const existing = siblings.get(groupId)
	if (existing) {
		return existing
	}

	const suiteGroup = controller.createTestItem(groupId, '[ABL Test Suites]')
	suiteGroup.canResolveChildren = false
	suiteGroup.description = 'ABLTestSuiteGroup'
	suiteGroup.tags = [ new TestTag('runnable'), new TestTag('ABLTestSuiteGroup') ]
	testData.set(suiteGroup, new ABLTestDir('TestSuiteGroup', '[ABL Test Suites]', groupId))
	siblings.add(suiteGroup)

	return suiteGroup
}

function getOrCreateDirNodeForFile (controller: TestController, file: Uri, isTestSuite: boolean) {
	let relPath: string | undefined = undefined
	let parent: TestItem | undefined = undefined
	const paths = workspace.asRelativePath(file, false).replace(/\\/g, '/').split('/')
	paths.pop()

	const workspaceFolder = workspace.getWorkspaceFolder(file)
	if (!workspaceFolder) { return }

	if (workspace.workspaceFolders!.length > 1) {
		parent = getWorkspaceFolderNode(controller, workspaceFolder)
	}

	if (isTestSuite) {
		parent = getTestSuiteNode(controller, workspaceFolder, parent)
	}

	for (const path of paths) {
		if (!relPath) {
			relPath = path
		} else {
			relPath = relPath + '/' + path
		}
		const dirUri = Uri.joinPath(workspaceFolder.uri, relPath)

		const siblings = parent?.children ?? controller.items
		const existing = siblings.get(dirUri.fsPath)
		if (existing) {
			parent = existing
			continue
		}

		const dirNode = controller.createTestItem(dirUri.fsPath, path, dirUri)
		dirNode.canResolveChildren = false
		dirNode.description = 'ABLTestDir'
		dirNode.tags = [ new TestTag('runnable'), new TestTag('ABL Test Dir') ]

		const data = new ABLTestDir('ABLTestDir', path, dirNode.uri!)
		testData.set(dirNode, data)
		siblings.add(dirNode)
		parent = dirNode
	}
	return parent
}

function createFileNode (file: Uri) {
	const fileAttrs = getTestFileAttrs(file)
	if (fileAttrs === 'none') {
		return undefined
	}
	const relativePath = workspace.asRelativePath(file.fsPath)

	if (fileAttrs === 'suite') {
		return new ABLTestSuite(relativePath)
	}

	if (file.fsPath.endsWith('.cls')) {
		return new ABLTestClass(relativePath)
	}
	return new ABLTestProgram(relativePath)
}

function getTestFileAttrs (file: Uri) {
	const testRegex = /@test/i
	const suiteRegex = /@testsuite/i

	const contents = readFileSync(file.fsPath).toString()
	if (!contents || contents.length < 1 || !testRegex.test(contents)) {
		return 'none'
	}

	if (suiteRegex.test(contents)) {
		return 'suite'
	}
	return 'other'
}

function gatherAllTestItems (collection: TestItemCollection) {
	const items: TestItem[] = []
	collection.forEach(item => {
		items.push(item)
		items.push(...gatherAllTestItems(item.children))
	})
	return items
}

function gatherTestItems (collection: TestItemCollection) {
	const items: TestItem[] = []
	for(const [, item] of collection) {
		items.push(item)
	}
	return items
}

function getExcludePatterns () {
	let excludePatterns: string[] = []

	let excludePatternsConfig: string[] | string | undefined = workspace.getConfiguration('ablunit').get('files.exclude', '**/.builder/**')
	if (typeof excludePatternsConfig === 'string') {
		excludePatternsConfig = excludePatternsConfig.split(',')
	}
	if (excludePatternsConfig.length == 1) {
		excludePatterns[0] = ''
		for (const pattern of excludePatternsConfig) {
			excludePatterns[0] = excludePatterns[0] + pattern
		}
	} else {
		excludePatterns = excludePatternsConfig
	}

	let retVal: RelativePattern[] = []
	for(const workspaceFolder of workspace.workspaceFolders!) {
		retVal = retVal.concat(excludePatterns.map(pattern => new RelativePattern(workspaceFolder, pattern)))
	}
	return retVal
}

function getWorkspaceTestPatterns () {
	let includePatternsConfig: string[] | string = workspace.getConfiguration('ablunit').get('files.include', [ '**/*.{cls,p}' ])
	let excludePatternsConfig: string[] | string = workspace.getConfiguration('ablunit').get('files.exclude', [ '**/.builder/**' ])

	if (typeof includePatternsConfig === 'string') {
		includePatternsConfig = [ includePatternsConfig ]
	}
	if (typeof excludePatternsConfig === 'string') {
		excludePatternsConfig = [ excludePatternsConfig ]
	}

	const includePatterns: RelativePattern[] = []
	const excludePatterns: RelativePattern[] = []

	if (!workspace.workspaceFolders) {
		let info='(workspace.name=' + workspace.name
		if (workspace.workspaceFile) {
			info = info + ', workspace.file=' + workspace.workspaceFile
		}
		info = info + ')'
		throw new Error('workspace has no folders ' + info)
	}
	for(const workspaceFolder of workspace.workspaceFolders) {
		includePatterns.push(...includePatternsConfig.map(pattern => new RelativePattern(workspaceFolder, pattern)))
		excludePatterns.push(...excludePatternsConfig.map(pattern => new RelativePattern(workspaceFolder, pattern)))
	}
	return { includePatterns, excludePatterns }
}

function deleteTest (controller: TestController | undefined, item: TestItem) {
	deleteChildren(controller, item)
	testData.delete(item)

	if(item.parent) {
		item.parent.children.delete(item.id)
		if(item.parent.children.size == 0) {
			deleteTest(controller, item.parent)
		}
	} else if (controller) {
		controller.items.delete(item.id)
	} else {
		throw new Error('deleteTest failed - could not find parent for item: ' + item.id)
	}
}

function deleteChildren (controller: TestController | undefined, item: TestItem) {
	for (const child of gatherTestItems(item.children)) {
		deleteChildren(controller, child)
		child.children.delete(item.id)
		testData.delete(child)
	}
}

function removeExcludedFiles (controller: TestController, excludePatterns: RelativePattern[], token?: CancellationToken) {
	if (excludePatterns.length === 0) { return }
	token?.onCancellationRequested(() => {
		log.debug('cancellation requested - removeExcludedFiles')
		throw new CancellationError()
	})

	const items = gatherAllTestItems(controller.items)

	for (const item of items) {
		const data = testData.get(item)
		if (item.id === 'ABLTestSuiteGroup') {
			removeExcludedChildren(item, excludePatterns)
		}
		if (item.uri && (data instanceof ABLTestSuite || data instanceof ABLTestClass || data instanceof ABLTestProgram)) {
			const excluded = isFileExcluded(item.uri, excludePatterns)
			if (excluded) {
				deleteTest(controller, item)
			}
		}
		if (item.children.size == 0 && data instanceof ABLTestDir) {
			deleteTest(controller, item)
		}
	}
}

function removeExcludedChildren (parent: TestItem, excludePatterns: RelativePattern[]) {
	if (!parent.children) {
		return
	}

	for(const [,item] of parent.children) {
		const data = testData.get(item)
		if (data instanceof ABLTestFile) {
			const excluded = isFileExcluded(item.uri!, excludePatterns)
			if (item.uri && excluded) {
				deleteTest(undefined, item)
			}
		} else if (data?.isFile) {
			removeExcludedChildren(item, excludePatterns)
			if (item.children.size == 0) {
				deleteTest(undefined, item)
			}
		}
	}
}

function findMatchingFiles (includePatterns: RelativePattern[], token: CancellationToken, checkCancellationToken: () => void): Promise<Uri[]> {
	const filelist: Uri[] = []
	const proms: PromiseLike<boolean>[] = []
	for (const includePattern of includePatterns) {
		const prom = workspace.findFiles(includePattern, undefined, undefined, token)
			.then((files) => {
				filelist.push(...files)
				return true
			}, (e) => { throw e })
		proms.push(prom)
		checkCancellationToken()
	}
	return Promise.all(proms)
		.then(() => {
			return filelist
		}, (e) => { throw e })
}

// async function parseMatchingFiles (files: Uri[], controller: TestController, excludePatterns: RelativePattern[], token: CancellationToken, checkCancellationToken: () => void, resolvedCount: number, rejectedCount: number) {
async function parseMatchingFiles (files: Uri[], controller: TestController, excludePatterns: RelativePattern[], token: CancellationToken, checkCancellationToken: () => void): Promise<boolean> {
	const proms: Promise<boolean>[] = []
	log.debug('parsing files... (count=' + files.length + ')')
	for (const file of files) {
		checkCancellationToken()

		const { item, data } = getOrCreateFile(controller, file, excludePatterns)
		if (item && data instanceof ABLTestFile) {
			const prom = data.updateFromDisk(controller, item, token).then((foundTestCase) => {
				return foundTestCase
			}, (e) => {
				log.error('failed to update file from disk. err=' + e)
				return false
			})
			proms.push(prom)
		}
	}
	log.info('330')
	const r = await Promise.all(proms).then(() => { return true })
	return r
}

function refreshTestTree (controller: TestController, token: CancellationToken): Promise<boolean> {
	log.info('refreshing test tree...')
	const startTime = Date.now()
	const searchCount = 0
	const resolvedCount = 0
	const rejectedCount = 0
	const filelist: Uri[] = []
	const elapsedTime = () => { return '(time=' + (Date.now() - startTime) + 'ms)' }
	const logResults = () => {
		log.info('refresh test tree complete! found ' + getControllerTestFileCount(controller) + ' files with test cases ' + elapsedTime())
		log.trace(' - ' + searchCount + ' files matching glob pattern(s)')
		log.trace(' - ' + filelist.length + ' files with potential test case(s)')
		log.trace(' - ' + resolvedCount + ' files parsed had one or more test case(s)')
		log.trace(' - ' + rejectedCount + ' files parsed had zero test case(s)')
	}

	// token.onCancellationRequested(() => {
	// 	log.info('cancellation requested ' + elapsedTime())
	// 	throw new CancellationError()
	// })

	const checkCancellationToken = () => {
		if (!token.isCancellationRequested) { return }
		log.debug('cancellation requested - checkCancellationToken ' + elapsedTime())
		logResults()
		throw new CancellationError()
	}
	const { includePatterns, excludePatterns } = getWorkspaceTestPatterns()
	log.info('includePatternslength=' + includePatterns.length + ', excludePatterns.length=' + excludePatterns.length)
	log.debug('includePatterns=' + includePatterns.map(pattern => pattern.pattern).join('\n'))
	log.debug('excludePatterns=' + excludePatterns.map(pattern => pattern.pattern).join('\n'))

	removeExcludedFiles(controller, excludePatterns, token)

	log.debug('finding files...')

	const prom1 = findMatchingFiles(includePatterns, token, checkCancellationToken)
		.then((r) => {
			log.info('return parseMatchingFiles (r=' + r + ')')
			return parseMatchingFiles(r, controller, excludePatterns, token, checkCancellationToken)
		})
		.then((r) => {
			log.info('return  true (r=' + r + ')')
			return true
		})
	return prom1.catch((e: unknown) => { throw e })
}

function getControllerTestFileCount (controller: TestController) {
	const getTestCount = (item: TestItem) => {
		let count = 0
		for(const [,child] of item.children) {
			if (testData.get(child) instanceof ABLTestFile) {
				count++
			} else {
				count += getTestCount(child)
			}
		}
		return count
	}

	let count = 0
	for(const [,item] of controller.items) {
		if (testData.get(item) instanceof ABLTestFile) {
			count ++
		} else {
			count += getTestCount(item)
		}
	}
	return count
}

// const createOrUpdateFile = (controller: TestController, uri: Uri) => {
// 	// const { includePatterns, excludePatterns } = getWorkspaceTestPatterns()
// 	// if (isFileExcluded(uri, excludePatterns))  {
// 	// 	return
// 	// }
// 	const { item, data } = getOrCreateFile(controller, uri)
// 	if (data?.didResolve) {
// 		controller.invalidateTestResults(item)
// 		data.updateFromDisk(controller, item).catch((err) => {
// 			log.error('failed to update file from disk. err=' + err)
// 			return false
// 		})
// 	}
// 	return true
// }


// function startWatchingWorkspace (controller: TestController) {
// 	log.info('start watching workspace')
// 	// const { includePatterns, excludePatterns } = getWorkspaceTestPatterns()
// 	// log.debug('includePatterns=' + includePatterns.length + ', excludePatterns=' + excludePatterns.length)
// 	// const watchers = []


// 	// for (const includePattern of includePatterns) {
// 	// 	log.info("create watcher for: " + includePattern.pattern)
// 	// 	const watcher = workspace.createFileSystemWatcher(includePattern)
// 	// 	// watcher.onDidCreate(uri => { createOrUpdateFile(controller, uri) })
// 	// 	// watcher.onDidChange(uri => { createOrUpdateFile(controller, uri) })
// 	// 	// watcher.onDidDelete(uri => { controller.items.delete(uri.fsPath) })
// 	// 	watchers.push(watcher)
// 	// }
// 	// return watchers
// }

function openCallStackItem (traceUriStr: string) {
	const traceUri = Uri.file(traceUriStr.split('&')[0])
	const traceLine = Number(traceUriStr.split('&')[1])
	return window.showTextDocument(traceUri).then(editor => {
		const lineToGoBegin = new Position(traceLine, 0)
		const lineToGoEnd = new Position(traceLine + 1, 0)
		editor.selections = [new Selection(lineToGoBegin, lineToGoEnd)]
		const range = new Range(lineToGoBegin, lineToGoEnd)
		log.info('decorating editor - openCallStackItem')
		editor.revealRange(range)
		return
	}, (e) => { throw e })
}

function isFileExcluded (uri: Uri, excludePatterns: RelativePattern[]) {
	const workspaceFolder = workspace.getWorkspaceFolder(uri)
	if (!workspaceFolder) { return true }

	const relativePath = workspace.asRelativePath(uri.fsPath, false)
	const patterns = excludePatterns.map(pattern => pattern.pattern)
	for (const pattern of patterns) {
		if (minimatch(relativePath, pattern)) {
			return true
		}
	}
	return false
}

export async function doesDirExist (uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.Directory) {
			return true
		}
		return false
	}, (err) => {
		log.info('caught: ' + err)
		return false
	})
	return ret
}

export async function doesFileExist (uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.File) {
			return true
		}
		return false
	}, (err) => {
		log.info('caught: ' + err)
		return false
	})
	return ret
}

function createDir (uri: Uri) {
	if(!uri) {
		return
	}
	return workspace.fs.stat(uri).then((stat) => {
		if (!stat) {
			return workspace.fs.createDirectory(uri)

		}
		return
	}, () => {
		return workspace.fs.createDirectory(uri)
	})
}

function logActivationEvent (extensionMode: ExtensionMode) {
	if (!log) {
		throw new Error('log is undefined')
	}
	if (extensionMode == ExtensionMode.Development) {
		log.setLogLevel(LogLevel.Debug)
	}
	log.info('activating extension! (version=' + getExtensionVersion() + ')')
}

function getExtensionVersion () {
	const ext = extensions.getExtension('kherring.ablunit-test-runner')
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (ext?.packageJSON && typeof ext.packageJSON.version === 'string') {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return ext.packageJSON.version as string
	}
	throw new Error('unable to get extension version')
}
