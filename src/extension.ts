import { commands, tests, window, workspace,
	CancellationToken, ConfigurationChangeEvent, EventEmitter, ExtensionContext, Position, Range, RelativePattern, Selection,
	TestController, TestItem, TestItemCollection, TestMessage, TestTag, TestRunProfileKind, TestRunRequest,
	TextDocument, Uri, WorkspaceFolder, FileType } from 'vscode'
import { ABLResults } from './ABLResults'
import { ABLTestSuite, ABLTestClass, ABLTestProgram, ABLTestFile, ABLTestCase, ABLTestDir, ABLTestData, resultData, testData } from './testTree'
import { GlobSync } from 'glob'
import { log } from './ABLUnitCommon'
import { readFileSync } from 'fs'
import { decorate, getRecentResults, setRecentResults } from './decorator'

export async function activate (context: ExtensionContext) {
	log.info('ACTIVATE!')

	const ctrl = tests.createTestController('ablunitTestController', 'ABLUnit Test')
	const contextStorageUri = context.storageUri ?? Uri.parse('file://' + process.env.TEMP) // will always be defined as context.storageUri
	const contextResourcesUri = Uri.joinPath(context.extensionUri,'resources')
	setContextPaths(contextStorageUri, contextResourcesUri)
	await createDir(contextStorageUri)

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
	}

	const fileChangedEmitter = new EventEmitter<Uri>()

	const runHandler = (request: TestRunRequest, cancellation: CancellationToken) => {
		if (! request.continuous) {
			return startTestRun(request)
		}
		const l = fileChangedEmitter.event(uri => {
			const file = getOrCreateFile(ctrl, uri).file
			if(file) {
				startTestRun(new TestRunRequest([file], undefined, request.profile, true))
			} else {
				log.error('startTestRun - file not found: ' + uri.fsPath)
			}
		})
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		cancellation.onCancellationRequested(() => l.dispose())
	}

	const configureHandler = () => {
		openTestRunConfig().catch((err) => {
			log.error("[configureHandler] Failed to open '.vscode/ablunit-test-profile.json'. err=" + err)
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

	const startTestRun = (request: TestRunRequest) => {

		const discoverTests = async (tests: Iterable<TestItem>) => {
			for (const test of tests) {
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
				if (!ret) { continue }

				if (r.ablResults) {
					const p = r.ablResults.resultsJson[0]
					const totals = 'Totals - ' + p.tests + ' tests, ' + p.passed + ' passed, ' + p.errors + ' errors, ' + p.failures + ' failures'
					log.info(totals, run)
					log.info('Duration - ' + r.duration() + 's', run)
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

			run.end()
			setRecentResults(resultData.get(run) ?? [])

			if (window.activeTextEditor) {
				decorate(window.activeTextEditor)
			}

			return showNotification('ablunit tests complete')
		}

		const createABLResults = async () => {
			const res: ABLResults[] = []
			const proms: Promise<void>[] = []

			for(const itemData of queue) {
				const wf = workspace.getWorkspaceFolder(itemData.test.uri!)

				if (!wf) {
					log.error('Skipping test run for test item with no workspace folder: ' + itemData.test.uri!.fsPath)
					continue
				}
				let r = res.find(r => r.workspaceFolder === wf)
				if (!r) {
					r = new ABLResults(wf, await getStorageUri(wf) ?? wf.uri, contextStorageUri, contextResourcesUri)
					await r.start()
					res.push(r)
				}
				proms.push(r.addTest(itemData.test, run))
			}
			await Promise.all(proms)
			resultData.set(run, res)
			return res
		}

		showNotification('running ablunit tests')
		const queue: { test: TestItem; data: ABLTestData }[] = []
		const run = ctrl.createTestRun(request)
		const tests = request.include ?? gatherTestItems(ctrl.items)

		discoverTests(tests).then(async () => {
			const res = await createABLResults()
			return runTestQueue(res)
		}).catch((err) => {
			log.error('ablunit run failed discovering tests with exception: ' + err, run)
			run.end()
		})
	}

	ctrl.refreshHandler = async () => {
		const patterns = getWorkspaceTestPatterns()

		for (const pattern of patterns) {
			await findInitialFiles(ctrl, pattern.workspaceFolder, pattern.includePatterns, pattern.excludePatterns, true)
		}
	}

	ctrl.resolveHandler = async item => {
		if (!item) {
			const workspaceWatchers = startWatchingWorkspace(ctrl, fileChangedEmitter)
			for (const watchers of workspaceWatchers) {
				context.subscriptions.push(...watchers)
			}
			return
		}
		const data = testData.get(item)
		if (data instanceof ABLTestFile) {
			return data.updateFromDisk(ctrl, item)
		}
	}

	function updateNodeForDocument (e: TextDocument) {
		const openEditors = window.visibleTextEditors.filter(editor => editor.document.uri === e.uri)
		openEditors.forEach(editor => {
			decorate(editor)})

		if (e.uri.scheme !== 'file') { return }
		if (!e.uri.path.endsWith('.cls') && !e.uri.path.endsWith('.p')) { return }

		if(isFileExcluded(e.uri,getExcludePatterns())) {
			return
		}

		const { file, data } = getOrCreateFile(ctrl, e.uri)
		if(file) {
			ctrl.invalidateTestResults(file)
			if (data) {
				data.updateFromContents(ctrl, e.getText(), file)
			}
		}
	}

	function updateConfiguration (e: ConfigurationChangeEvent) {
		if (e.affectsConfiguration('ablunit')) {
			removeExcludedFiles(ctrl, getExcludePatterns())
		}
	}

	const testRunProfile = ctrl.createRunProfile('Run ABLUnit Tests', TestRunProfileKind.Run, runHandler, false, new TestTag('runnable'), false)
	testRunProfile.configureHandler = configureHandler
	const testCoverageProfile = ctrl.createRunProfile('Run ABLUnit Tests w/ Coverage', TestRunProfileKind.Coverage, runHandler, true, new TestTag('runnable'), false)
	testCoverageProfile.configureHandler = configureHandler
	const testDebugProfile = ctrl.createRunProfile('Debug ABLUnit Tests', TestRunProfileKind.Debug, runHandler, false, new TestTag("runnable"), false)
	testDebugProfile.configureHandler = configureHandler

	if(workspace.getConfiguration('ablunit').get('discoverFilesOnActivate', false)) {
		await commands.executeCommand('testing.refreshTests')
	}
}

let contextStorageUri: Uri
let contextResourcesUri: Uri

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

function getOrCreateFile (controller: TestController, uri: Uri) {
	const existing = getExistingTestItem(controller, uri)
	if (existing) {
		const data = testData.get(existing)
		if (!data) {
			log.info('[getOrCreateFile] data not found for existing item. file=' + workspace.asRelativePath(uri) + ', existing.id=' + existing.id)
			throw new Error('[getOrCreateFile] data not found for existing item. file=' + workspace.asRelativePath(uri) + ', existing.id=' + existing.id)
		}
		if (data instanceof ABLTestFile) {
			return { file: existing, data: data }
		} else {
			log.info('[getOrCreateFile] unexpected data type for existing item. file=' + workspace.asRelativePath(uri) + ', existing.id=' + existing.id)
			throw new Error('[getOrCreateFile] unexpected data type.' +
								' file=' + workspace.asRelativePath(uri) +
								', existing.id=' + existing.id +
								', data.description=' + data?.description)
		}
	}

	const data = createFileNode(uri)
	if(!data) {
		log.warn('No tests found in file: ' + uri.fsPath)
		return { file: undefined, data: undefined }
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
	return { file, data }
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
	let includePatterns: string[] | string = workspace.getConfiguration('ablunit').get('files.include', [ '**/*.{cls,p}' ])
	let excludePatterns: string[] | string = workspace.getConfiguration('ablunit').get('files.exclude', [ '**/.builder/**' ])

	if (typeof includePatterns === 'string') {
		includePatterns = [ includePatterns ]
	}
	if (typeof excludePatterns === 'string') {
		excludePatterns = [ excludePatterns ]
	}

	const retVal: { workspaceFolder: WorkspaceFolder, includePatterns: RelativePattern[], excludePatterns: RelativePattern[] }[] = []
	for(const workspaceFolder of workspace.workspaceFolders!) {
		retVal.push({
			workspaceFolder,
			includePatterns: includePatterns.map(pattern => new RelativePattern(workspaceFolder, pattern)),
			excludePatterns: excludePatterns.map(pattern => new RelativePattern(workspaceFolder, pattern))
		})
	}
	return retVal
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

function removeExcludedFiles (controller: TestController, excludePatterns: RelativePattern[]) {
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

async function findInitialFiles (
	controller: TestController,
	workspaceFolder: WorkspaceFolder,
	includePatterns: RelativePattern[],
	excludePatterns: RelativePattern[],
	removeExcluded: boolean = false) {
	const discoverFilesOnActivate = workspace.getConfiguration('ablunit').get('discoverFilesOnActivate')

	if (!discoverFilesOnActivate) {
		if (removeExcluded) {
			removeExcludedFiles(controller, excludePatterns)
		}
		return
	}

	const updates: Promise<void>[] = []
	for (const includePattern of includePatterns) {
		for (const wsFile of await workspace.findFiles(includePattern)) {
			if (isFileExcluded(wsFile, excludePatterns)) {
				continue
			}
			const { file, data } = getOrCreateFile(controller, wsFile)
			if(file) {
				updates.push(data.updateFromDisk(controller, file))
			}
		}
	}
	await Promise.all(updates)

	if (removeExcluded) {
		removeExcludedFiles(controller, excludePatterns)
	}
}

function startWatchingWorkspace (controller: TestController, fileChangedEmitter: EventEmitter<Uri>) {

	return getWorkspaceTestPatterns().map(({ includePatterns, excludePatterns }) => {

		const watchers = []

		for (const includePattern of includePatterns) {
			const watcher = workspace.createFileSystemWatcher(includePattern)

			watcher.onDidCreate(uri => {
				if (isFileExcluded(uri, excludePatterns))  {
					return
				}
				getOrCreateFile(controller, uri)
				fileChangedEmitter.fire(uri)
			})

			watcher.onDidChange(async uri => {
				if (isFileExcluded(uri,excludePatterns)) {
					return
				}

				const { file, data } = getOrCreateFile(controller, uri)
				if (data?.didResolve) {
					controller.invalidateTestResults(file)
					await data.updateFromDisk(controller, file)
				}
				fileChangedEmitter.fire(uri)
			})

			watcher.onDidDelete(uri => {
				controller.items.delete(uri.fsPath)
			})
			watchers.push(watcher)
		}

		return watchers
	})

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
	log.info('[showNotification] ' + message)
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
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
	const g = new GlobSync(relativePath, { cwd: workspaceFolder.uri.fsPath, ignore: patterns })
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	return g.found.length == 0
}


export async function doesDirExist (uri: Uri) {
	const ret = await workspace.fs.stat(uri).then((stat) => {
		if (stat.type === FileType.Directory) {
			return true
		}
		return false
	}, (err) => {
		log.info("[doesDirExist] caught: " + err)
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
		log.info("[doesFileExist] caught: " + err)
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
			log.info('[createDir] stat=' + JSON.stringify(stat))
			log.info('[createDir] create-1: ' + uri.fsPath)
			return workspace.fs.createDirectory(uri)
		}
	}, () => {
		log.info('[createDir] create dir (' + uri.fsPath + ')')
		return workspace.fs.createDirectory(uri)
	})
}
