import { commands, tests, window, workspace,
	CancellationToken, ConfigurationChangeEvent, EventEmitter, ExtensionContext, Position, Range, RelativePattern, Selection,
	TestController, TestItem, TestItemCollection, TestMessage, TestTag, TestRunProfileKind, TestRunRequest,
	TextDocument, Uri, WorkspaceFolder, FileType, CancellationError, TestRun } from 'vscode'
import { ABLResults } from './ABLResults'
import { ABLTestSuite, ABLTestClass, ABLTestProgram, ABLTestFile, ABLTestCase, ABLTestDir, ABLTestData, resultData, testData } from './testTree'
import { GlobSync } from 'glob'
import { log } from './ABLUnitCommon'
import { readFileSync } from 'fs'
import { decorate, getRecentResults, setRecentResults } from './decorator'

export async function activate (context: ExtensionContext) {
	log.info('activating extension!')

	const ctrl = tests.createTestController('ablunitTestController', 'ABLUnit Test')
	const contextStorageUri = context.storageUri ?? Uri.parse('file://' + process.env.TEMP) // will always be defined as context.storageUri
	const contextResourcesUri = Uri.joinPath(context.extensionUri,'resources')
	setContextPaths(contextStorageUri, contextResourcesUri, ctrl)
	await createDir(contextStorageUri)

	const getTestController = () => { return ctrl }
	const fileChangedEmitter = new EventEmitter<Uri>()

	context.subscriptions.push(ctrl)

	context.subscriptions.push(
		commands.registerCommand('_ablunit.openCallStackItem', openCallStackItem),
		window.onDidChangeActiveTextEditor(e => { decorate(e!) }),
		workspace.onDidChangeConfiguration(e => { updateConfiguration(e) }),
		workspace.onDidOpenTextDocument(updateNodeForDocument),
		workspace.onDidChangeTextDocument(e => { updateNodeForDocument(e.document) }),
	)

	if (process.env.ABLUNIT_TEST_RUNNER_UNIT_TESTING === 'true') {
		context.subscriptions.push(commands.registerCommand('_ablunit.getRecentResults', getRecentResults))
		context.subscriptions.push(commands.registerCommand('_ablunit.getTestController', getTestController))
	}

	const runHandler = (request: TestRunRequest, cancellation: CancellationToken) => {
		if (! request.continuous) {
			return startTestRun(request, cancellation)
				.then(() => { return })
				.catch((err) => {
					log.error("startTestRun failed. err=" + err)
					throw err
				})
		}
		log.error('continuous test runs not implemented')
		throw new Error('continuous test runs not implemented')
	}

	const configureHandler = () => {
		openTestRunConfig().catch((err) => {
			log.error("Failed to open '.vscode/ablunit-test-profile.json'. err=" + err)
		})
	}

	async function openTestRunConfig () {
		let workspaceFolder: WorkspaceFolder
		if (workspace.workspaceFolders?.length === 1) {
			workspaceFolder = workspace.workspaceFolders[0]
		} else {
			throw new Error('configureHandler not implemented for multi-folder workspaces')
		}


		const uri = Uri.joinPath(workspaceFolder.uri, '.vscode', 'ablunit-test-profile.json')
		const det = Uri.joinPath(context.extensionUri, 'resources', 'ablunit-test-profile.details.jsonc')
		const dir = Uri.joinPath(workspaceFolder.uri, '.vscode')

		const exists = await doesFileExist(uri)
		if (!exists) {
			await createDir(dir)
			await workspace.fs.copy(det, uri, { overwrite: false }).then(() => {
				log.info('successfully created .vscode/ablunit-test-profile.json')
			}, (err) => {
				log.error('failed to create .vscode/ablunit-test-profile.json. err=' + err)
				throw(err)
			})
		}

		window.showTextDocument(Uri.joinPath(workspaceFolder.uri, '.vscode', 'ablunit-test-profile.json')).then(() => {
			log.info("Opened .vscode/ablunit-test-profile.json")
		}, (err) => {
			log.error('Failed to open .vscode/ablunit-test-profile.json! err=' + err)
		})
	}

	const startTestRun = (request: TestRunRequest, cancellation: CancellationToken) => {

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
					run.skipped(test)
				} else {
					run.started(test)
					for(const childTest of gatherTestItems(test.children)) {
						run.started(childTest)
					}
				}
			}

			log.info('starting ablunit run', run)

			let ret = false
			for (const r of res) {
				r.setTestData(testData.getMap())
				if (res.length > 1) {
					log.info('starting ablunit tests for folder: ' + r.workspaceFolder.uri.fsPath, run)
				}

				ret = await r.run(run).then(() => {
					return true
				}, (err) => {
					log.error('ablunit run failed with exception: ' + err, run)
					return false
				})
				if (!ret) {
					continue
				}

				if (r.ablResults) {
					const p = r.ablResults.resultsJson[0]
					const totals = 'Totals - ' + p.tests + ' tests, ' + p.passed + ' passed, ' + p.errors + ' errors, ' + p.failures + ' failures'
					log.info(totals, run)
					log.info('Duration - ' + r.duration() + 's', run)
				} else {
					log.debug('cannot print totals - missing ablResults object')
				}

				for (const { test } of queue) {
					if (workspace.getWorkspaceFolder(test.uri!) === r.workspaceFolder) {
						if (run.token.isCancellationRequested) {
							run.skipped(test)
						} else {
							await r.assignTestResults(test, run)
						}
					}
				}
			}

			if(!ret) {
				for (const { test } of queue) {
					run.errored(test,new TestMessage('ablunit run failed'))
					for (const childTest of gatherTestItems(test.children)) {
						run.errored(childTest,new TestMessage('ablunit run failed'))
					}
				}
				run.end()
				return
			}

			log.info('ablunit test run complete', run)

			if (run.token.isCancellationRequested) {
				for (const { test } of queue) {
					run.skipped(test)
				}
			}

			setRecentResults(resultData.get(run) ?? [])

			if (window.activeTextEditor) {
				decorate(window.activeTextEditor)
			}

			showNotification('ablunit tests complete')
			run.end()
			return
		}

		const createABLResults = async () => {
			const res: ABLResults[] = []
			const proms: Promise<void>[] = []

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
					r = new ABLResults(wf, await getStorageUri(wf) ?? wf.uri, contextStorageUri, contextResourcesUri)
					cancellation.onCancellationRequested(() => {
						log.debug('cancellation requested')
						r?.dispose()
						throw new CancellationError()
					})
					await r.start()
					res.push(r)
				}
				proms.push(r.addTest(itemData.test, run))
			}
			return await Promise.all(proms).then(() => {
				resultData.set(run, res)
				log.debug('all tests added to test run results object')
				return res
			})
		}

		showNotification('running ablunit tests')
		const queue: { test: TestItem; data: ABLTestData }[] = []
		const run = ctrl.createTestRun(request)
		cancellation.onCancellationRequested(() => {
			log.debug("cancellation requested")
			run.end()
			throw new CancellationError()
		})
		const tests = request.include ?? gatherTestItems(ctrl.items)

		return discoverTests(tests).then(async () => {
			return createABLResults().then((res) => {
				if (!res) {
					throw new Error('createABLResults failed')
				} else
					checkCancellationRequested(run)
				return runTestQueue(res).then(() => {
					log.debug('runTestQueue complete')
					return true
				})
			})
		}).catch((err) => {
			run.end()
			console.log('err')
			throw (err)
		})
	}

	ctrl.refreshHandler = async (token: CancellationToken) => refreshTestTree(ctrl, token)

	ctrl.resolveHandler = async item => {
		if (!item) {
			const watchers = startWatchingWorkspace(ctrl, fileChangedEmitter)
			context.subscriptions.push(...watchers)

			// find initial items
			if(workspace.getConfiguration('ablunit').get('discoverFilesOnActivate', false)) {
				log.trace('discoverFilesOnActivate is true. refreshing test tree...')
				commands.executeCommand('testing.refreshTests').then(() => {
					log.trace('tests tree successfully refreshed on workspace startup')
				}, (err) => {
					log.error('failed to refresh test tree. err=' + err)
				})
			} else {
				for (const e of window.visibleTextEditors) {
					updateNodeForDocument(e.document)
				}
			}

			return
		}
		const data = testData.get(item)
		if (data instanceof ABLTestFile) {
			return data.updateFromDisk(ctrl, item).then(() => {}, (err) => { throw err })
		}
	}

	function updateNodeForDocument (e: TextDocument) {
		const openEditors = window.visibleTextEditors.filter(editor => editor.document.uri === e.uri)
		openEditors.forEach(editor => {
			decorate(editor)})

		if (e.uri.scheme !== 'file') { return }
		if (!e.uri.path.endsWith('.cls') && !e.uri.path.endsWith('.p')) { return }

		if(isFileExcluded(e.uri, getExcludePatterns())) {
			return
		}

		const { item, data } = getOrCreateFile(ctrl, e.uri)
		if(item) {
			ctrl.invalidateTestResults(item)
			if (data) {
				data.updateFromContents(ctrl, e.getText(), item)
			}
		}
	}

	function updateConfiguration (e: ConfigurationChangeEvent) {
		if (e.affectsConfiguration('ablunit')) {
			removeExcludedFiles(ctrl, getExcludePatterns())
		}
		if (e.affectsConfiguration('ablunit.files.include') || e.affectsConfiguration('ablunit.files.exclude')) {
			removeExcludedFiles(ctrl, getExcludePatterns())
		}
	}

	const testRunProfile = ctrl.createRunProfile('ABLUnit - Run Tests', TestRunProfileKind.Run, runHandler, false, new TestTag('runnable'), false)
	testRunProfile.configureHandler = configureHandler
	// const testCoverageProfile = ctrl.createRunProfile('Run ABLUnit Tests w/ Coverage', TestRunProfileKind.Coverage, runHandler, true, new TestTag('runnable'), false)
	// testCoverageProfile.configureHandler = configureHandler
	// const testDebugProfile = ctrl.createRunProfile('Debug ABLUnit Tests', TestRunProfileKind.Debug, runHandler, false, new TestTag("runnable"), false)
	// testDebugProfile.configureHandler = configureHandler
}

let contextStorageUri: Uri
let contextResourcesUri: Uri
let testController: TestController

export function setContextPaths (storageUri: Uri, resourcesUri: Uri, controller: TestController) {
	contextStorageUri = storageUri
	contextResourcesUri = resourcesUri
	testController = controller
}

export function getContextStorageUri () {
	return contextStorageUri
}

export function getContextResourcesUri () {
	return contextResourcesUri
}

export function getTestController () {
	return testController
}

export function checkCancellationRequested (run: TestRun) {
	if (run.token.isCancellationRequested) {
		log.info("test run cancellation requested")
		run.end()
		throw new CancellationError()
	}
}

async function getStorageUri (workspaceFolder: WorkspaceFolder) {
	if (!getContextStorageUri) { throw new Error('contextStorageUri is undefined') }

	const dirs = workspaceFolder.uri.path.split('/')
	const ret = Uri.joinPath(getContextStorageUri(),dirs[dirs.length - 1])
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

function getOrCreateFile (controller: TestController, uri: Uri, token?: CancellationToken, excludePatterns?: RelativePattern[]) {
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
								', data.description=' + data?.description)
		}
	}

	const data = createFileNode(uri)
	if(!data) {
		log.trace('No tests found in file: ' + uri.fsPath)
		return { item: undefined, data: undefined }
	}
	const file = controller.createTestItem(uri.fsPath, workspace.asRelativePath(uri.fsPath), uri)
	testData.set(file, data)
	data.didResolve = false
	file.description = 'To be parsed...'
	file.tags = [ new TestTag('runnable') ]

	const parent = getOrCreateDirNodeForFile(controller, uri, (data instanceof ABLTestSuite))
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
	testData.set(suiteGroup, new ABLTestDir('TestSuiteGroup', '[ABL Test Suites]' , groupId))
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

	const excludePatternsConfig: string[] | undefined = workspace.getConfiguration('ablunit').get('files.exclude', [ '**/.builder/**' ])
	if (excludePatternsConfig[0].length == 1) {
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

	for(const workspaceFolder of workspace.workspaceFolders!) {
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
		log.info('cancellation requested')
		throw new CancellationError()
	})

	const items = gatherAllTestItems(controller.items)

	for (const element of items) {
		const item = element
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
		if (item.children.size == 0 && (data instanceof ABLTestDir)) {
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

async function refreshTestTree (controller: TestController, token: CancellationToken) {
	log.info('refreshing test tree...')
	const startTime = Date.now()
	let searchCount = 0
	let resolvedCount = 0
	let rejectedCount = 0
	const filelist: Uri[] = []
	const elapsedTime = () => { return '(time=' + (Date.now() - startTime) + 'ms)' }
	const logResults = () => {
		log.info('refresh test tree complete! found ' + getControllerTestFileCount(controller) + ' files with test cases ' + elapsedTime())
		log.debug(' - ' + searchCount + ' files matching glob pattern(s)')
		log.debug(' - ' + filelist.length + ' files with potential test case(s)')
		log.debug(' - ' + resolvedCount + ' files parsed had one or more test case(s)')
		log.debug(' - ' + rejectedCount + ' files parsed had zero test case(s)')
	}

	token.onCancellationRequested(() => {
		log.info('cancellation requested ' + elapsedTime())
		throw new CancellationError()
	})

	const checkCancellationToken = () => {
		if (token.isCancellationRequested) {
			log.warn('cancellation requested ' + elapsedTime())
			logResults()
			throw new CancellationError()
		}
	}
	const { includePatterns, excludePatterns } = getWorkspaceTestPatterns()
	removeExcludedFiles(controller, excludePatterns, token)

	for (const includePattern of includePatterns) {
		const prom = workspace.findFiles(includePattern, undefined, undefined, token).then((foundFiles) => {
			foundFiles =  foundFiles.filter(uri => !isFileExcluded(uri, excludePatterns))
			return foundFiles
		}, (err) => {
			log.error('caught error searching included files for tests: ' + err)
			throw err
		})
		const patternFiles = await prom
		filelist.push(...patternFiles)
		checkCancellationToken()
	}

	for (const file of filelist) {
		searchCount++
		checkCancellationToken()

		const { item, data } = getOrCreateFile(controller, file, token, excludePatterns)
		if (item && data instanceof ABLTestFile) {
			const foundTestCase = data.updateFromDisk(controller, item, token)
			if (await foundTestCase) {
				resolvedCount++
			} else {
				rejectedCount++
			}
		}
	}

	if (token.isCancellationRequested) {
		log.debug('cancellation requested! ... but we\'re already done ' + elapsedTime())
	}

	logResults()
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

function startWatchingWorkspace (controller: TestController, fileChangedEmitter: EventEmitter<Uri>) {
	const { includePatterns, excludePatterns } = getWorkspaceTestPatterns()
	const watchers = []

	const createOrUpdateFile = (controller: TestController, uri: Uri) => {
		if (isFileExcluded(uri, excludePatterns))  {
			return
		}
		const { item, data } = getOrCreateFile(controller, uri)
		if (data?.didResolve) {
			controller.invalidateTestResults(item)
			// todo - the fileChangeEmitter might make this unneccessary
			// await data.updateFromDisk(controller, file)
		}
		fileChangedEmitter.fire(uri)
	}

	for (const includePattern of includePatterns) {
		const watcher = workspace.createFileSystemWatcher(includePattern)
		watcher.onDidCreate(uri => createOrUpdateFile(controller, uri))
		watcher.onDidChange(uri => createOrUpdateFile(controller, uri))
		watcher.onDidDelete(uri => { controller.items.delete(uri.fsPath) })
		watchers.push(watcher)
	}
	return watchers

}

function openCallStackItem (traceUriStr: string) {
	const traceUri = Uri.parse(traceUriStr.split('&')[0])
	const traceLine = Number(traceUriStr.split('&')[1])
	return window.showTextDocument(traceUri).then(editor => {
		const lineToGoBegin = new Position(traceLine,0)
		const lineToGoEnd = new Position(traceLine + 1,0)
		editor.selections = [new Selection(lineToGoBegin, lineToGoEnd)]
		const range = new Range(lineToGoBegin, lineToGoEnd)
		decorate(editor)
		editor.revealRange(range)
	})
}

function showNotification (message: string) {
	log.info(message)
	if (workspace.getConfiguration('ablunit').get('notificationsEnabled', true)) {
		void window.showInformationMessage(message)
	}
}

function isFileExcluded (uri: Uri, excludePatterns: RelativePattern[]) {
	const patterns = excludePatterns.map(pattern => pattern.pattern)
	const relativePath = workspace.asRelativePath(uri.fsPath, false)
	const workspaceFolder = workspace.getWorkspaceFolder(uri)
	if (!workspaceFolder) {
		return true
	}
	const g = new GlobSync(relativePath, { cwd: workspaceFolder.uri.fsPath, ignore: patterns })
	return g.found.length == 0
}


export async function doesDirExist (uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.Directory) {
			return true
		}
		return false
	}, (err) => {
		log.info("caught: " + err)
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
		log.info("caught: " + err)
		return false
	})
	return ret
}

async function createDir (uri: Uri) {
	if(!uri) {
		return
	}
	return workspace.fs.stat(uri).then((stat) => {
		if (!stat) {
			return workspace.fs.createDirectory(uri)
		}
	}, () => {
		return workspace.fs.createDirectory(uri)
	})
}
