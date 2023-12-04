import { commands, tests, window, workspace,
	CancellationToken, ConfigurationChangeEvent, DecorationOptions, EventEmitter, ExtensionContext, Position, Range, RelativePattern, Selection,
	TestController, TestItem, TestItemCollection, TestMessage,  TestRun, TestTag, TestRunProfileKind, TestRunRequest,
	TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode'
import { ABLResults } from './ABLResults'
import { ABLTestSuite, ABLTestClass, ABLTestProgram, ABLTestMethod, ABLTestProcedure, testData, ABLTestFile, ABLTestCase, ABLRunnable, ABLTestDir } from './testTree'
import { GlobSync } from 'glob'
import { logToChannel } from './ABLUnitCommon'
import { readFileSync } from 'fs'

const backgroundExecutable = window.createTextEditorDecorationType({
	backgroundColor: 'rgba(255,0,0,0.1)',
})
const backgroundExecuted = window.createTextEditorDecorationType({
	backgroundColor: 'rgba(0,255,0,0.1)',
})

let recentResults: ABLResults[] | undefined
let contextStorageUri: Uri | undefined = undefined

const resultData = new WeakMap<TestRun, ABLResults[]>()

export async function getStorageUri (workspaceFolder: WorkspaceFolder) {
	if (!contextStorageUri) { throw new Error("contextStorageUri is undefined") }

	const dirs = workspaceFolder.uri.path.split('/')
	const ret = Uri.joinPath(contextStorageUri,dirs[dirs.length - 1])
	await createDir(ret)
	return ret
}

export async function activate(context: ExtensionContext) {

	logToChannel("ACTIVATE!")
	if(!workspace.workspaceFolders) {
		return
	}

	const debugEnabled = workspace.getConfiguration('ablunit').get('debugEnabled', false)
	const ctrl = tests.createTestController('ablunitTestController', 'ABLUnit Test')
	contextStorageUri = context.storageUri ?? Uri.parse("file://" + process.env.TEMP) //will always be defined as context.storageUri
	await createDir(contextStorageUri)

	context.subscriptions.push(ctrl)
	context.subscriptions.push(
		commands.registerCommand('_ablunit.openCallStackItem', openCallStackItem),
		window.onDidChangeActiveTextEditor(e => decorate(e!) ),
		workspace.onDidChangeConfiguration(e => updateConfiguration(e)),
		workspace.onDidOpenTextDocument(updateNodeForDocument),
		workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	)

	const fileChangedEmitter = new EventEmitter<Uri>()

	const runHandler = (request: TestRunRequest, cancellation: CancellationToken) => {
		if (!request.continuous) {
			return startTestRun(request)
		}

		const l = fileChangedEmitter.event(uri => {
			const file = getOrCreateFile(ctrl, uri).file
			if(file) {
				startTestRun(
					new TestRunRequest(
						[file],
						undefined,
						request.profile,
						true
					)
				)
			} else {
				logToChannel("startTestRun - file not found: " + uri.fsPath, "error")
			}
		})
		cancellation.onCancellationRequested(() => l.dispose())
	}

	const startTestRun = (request: TestRunRequest) => {

		const discoverTests = async (tests: Iterable<TestItem>) => {
			for (const test of tests) {
				if (request.exclude?.includes(test)) {
					continue
				}

				const data = testData.get(test)
				if (debugEnabled) {
					printDataType(data)
				}

				if (data instanceof ABLTestSuite ||
					data instanceof ABLTestClass ||
					data instanceof ABLTestProgram ||
					data instanceof ABLTestMethod ||
					data instanceof ABLTestProcedure) {
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

			logToChannel('starting ablunit run')
			run.appendOutput('starting ablunit run\r\n')

			let ret = false
			for (const r of res) {
				r.setTestData(testData)
				logToChannel("starting ablunit tests for folder: " + r.workspaceFolder.uri.fsPath)
				run.appendOutput("starting ablunit tests for folder: " + r.workspaceFolder.uri.fsPath + "\r\n")
				ret = await r.run(run).then(() => {
					return true
				}, (err) => {
					logToChannel("ablunit run failed with exception: " + err,'error')
					return false
				})
				if (!ret) {
					console.error("ablunit run failed?")
					continue
				}

				if (r.ablResults) {
					const p = r.ablResults.resultsJson[0]
					const totals = "Totals - " + p.tests + " tests, " + p.passed + " passed, " + p.errors + " errors, " + p.failures + " failures"
					logToChannel(totals)
					logToChannel("Duration - " + r.duration() + "s")
					run.appendOutput(totals + "\r\n")
					run.appendOutput("Duration - " + r.duration() + "s\r\n")
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
					run.errored(test,new TestMessage("ablunit run failed"))
					for (const childTest of gatherTestItems(test.children)) {
						run.errored(childTest,new TestMessage("ablunit run failed"))
					}
				}
				run.end()
				return
			}

			logToChannel('ablunit run complete')
			run.appendOutput('ablunit run complete\r\n')

			if (run.token.isCancellationRequested) {
				for (const { test } of queue) {
					run.skipped(test)
				}
			}

			run.end()
			recentResults = resultData.get(run)

			if (window.activeTextEditor) {
				decorate(window.activeTextEditor)
			}

			showNotification("ablunit tests complete")
		}

		const createABLResults = async () => {
			const res: ABLResults[] = []
			const proms: Promise<void>[] = []

			for(const itemData of queue) {
				const wf = workspace.getWorkspaceFolder(itemData.test.uri!)

				if (!wf) {
					console.error("Skipping test run for test item with no workspace folder: " + itemData.test.uri!.fsPath)
					continue
				}
				let r = res.find(r => r.workspaceFolder === wf)
				if (!r) {
					r = new ABLResults(wf, await getStorageUri(wf) ?? wf.uri, contextStorageUri!)
					await r.start()
					res.push(r)
				}
				proms.push(r.addTest(itemData.test))
			}
			await Promise.all(proms)
			resultData.set(run, res)
			return res
		}

		showNotification("running ablunit tests")
		const queue: { test: TestItem; data: ABLRunnable }[] = []
		const run = ctrl.createTestRun(request)
		const tests = request.include ?? gatherTestItems(ctrl.items)

		discoverTests(tests).then(async () => {
			const res = await createABLResults()
			runTestQueue(res)
		})
	}

	ctrl.refreshHandler = async () => {
		const proms: Promise<void>[] = []
		const patterns = getWorkspaceTestPatterns()

		for (const pattern of patterns) {
			await findInitialFiles(ctrl, pattern.workspaceFolder, pattern.includePatterns, pattern.excludePatterns, true)
		}
	}

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter))
			return
		}
		const data = testData.get(item)
		// if (data instanceof ABLTestSuite || data instanceof ABLTestClass || data instanceof ABLTestProgram) {
		if (data instanceof ABLTestFile) {
			return data.updateFromDisk(ctrl, item)
		}
	}

	async function updateNodeForDocument(e: TextDocument) {
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

	async function updateConfiguration(e: ConfigurationChangeEvent) {
		if (e.affectsConfiguration('ablunit')) {
			removeExcludedFiles(ctrl, getExcludePatterns())
		}
	}

	ctrl.createRunProfile('Run Tests', TestRunProfileKind.Run, runHandler, false, new TestTag("runnable"), false)
	// ctrl.createRunProfile('Debug Tests', vscode.TestRunProfileKind.Debug, runHandler, false, new vscode.TestTag("runnable"), false)

	if(workspace.getConfiguration('ablunit').get('findAllFilesAtStartup', false)) {
		commands.executeCommand('testing.refreshTests')
	}
}

function getExistingTestItem (controller: TestController, uri: Uri) {
	const items = gatherAllTestItems(controller.items)
	const relPath = workspace.asRelativePath(uri.fsPath)

	const existRel = items.find(item => item.id === relPath)
	if (existRel) {
		return existRel
	}

	const existUri = items.find(item => item.id === uri.fsPath)
	if (existUri) {
		return existUri
	}

	return undefined
}

function getOrCreateFile(controller: TestController, uri: Uri) {
	const existing = getExistingTestItem(controller, uri)
	if (existing) {
		const data = testData.get(existing)
		if (!data) {
			throw new Error("[getOrCreateFile] data not found for existing item. file=" + workspace.asRelativePath(uri) + ", existing.id=" + existing.id)
		}
		if (data instanceof ABLTestSuite) {
			return { file: existing, data: data }
		} else if (data instanceof ABLTestClass) {
			return { file: existing, data: data }
		} else if (data instanceof ABLTestProgram) {
			return { file: existing, data: data }
		} else {
			throw new Error("[getOrCreateFile] unexpected data type." +
								" file=" + workspace.asRelativePath(uri) +
								", existing.id=" + existing.id +
								", data.description=" + data?.description)
		}
	}

	const data = createFileNode(uri)
	if(!data) {
		return { file: undefined, data: undefined }
	}
	data.didResolve = false

	const file = controller.createTestItem(uri.fsPath, workspace.asRelativePath(uri.fsPath), uri)
	file.description = "To be parsed..."
	file.tags = [ new TestTag("runnable") ]

	const parent = getOrCreateDirNode(controller, uri, (data instanceof ABLTestSuite))
	if (parent) {
		parent.children.add(file)
	} else {
		controller.items.add(file)
	}

	testData.set(file, data)
	file.canResolveChildren = false
	return { file, data }
}

function getOrCreateDirNode(controller: TestController, uri: Uri, isTestSuite: boolean) {
	let relPath: string | undefined = undefined
	let parent: TestItem | undefined = undefined

	const workspaceFolder = workspace.getWorkspaceFolder(uri)
	if(!workspaceFolder) { return }
	const relativePath = workspace.asRelativePath(uri,false).replace(/\\/g, '/')

	const paths = relativePath.split('/').reverse()
	paths.shift()

	let wfName: string | undefined = undefined
	if (workspace.workspaceFolders!.length > 1) {
		wfName = workspaceFolder.name
		paths.unshift(workspaceFolder.uri.fsPath.replace(/\\/g,'/').split('/').reverse()[0])
	}

	let suiteGroup: TestItem | undefined = undefined
	if (isTestSuite) {
		suiteGroup = controller.items.get("ABLTestSuiteGroup")
		if(!suiteGroup) {
			suiteGroup = controller.createTestItem("ABLTestSuiteGroup", "[ABL Test Suites]")
			suiteGroup.canResolveChildren = false
			suiteGroup.description = "ABLTestSuiteGroup"
			suiteGroup.tags = [ new TestTag("runnable"), new TestTag("ABLTestSuiteGroup") ]

			if (!testData.get(suiteGroup!)) {
				const data = new ABLTestDir('[ABL Test Suites]')
				testData.set(suiteGroup, data)
			}
		}

		//TODO: add test suite support
		//currently works for workspaces, but not for folders.
		//test in workspace with single folder too
	}

	for (const path of paths) {
		if (!relPath) {
			relPath = path
		} else {
			relPath = relPath + "/" + path
			wfName = undefined
			suiteGroup = undefined
		}

		const uri = Uri.joinPath(workspaceFolder.uri, '..', relPath)

		let existing: TestItem | undefined = undefined
		if (!parent) {
			existing = controller.items.get(uri.fsPath)
		} else {
			existing = parent.children.get(uri.fsPath)
		}
		if (existing) {
			parent = existing
			if (suiteGroup) {
				const sg = parent.children.get("ABLTestSuiteGroup")
				if(!sg) {
					parent.children.add(suiteGroup)
					suiteGroup = undefined
				}
				parent = sg
			}
			continue
		}

		let dir = controller.createTestItem(uri.fsPath, path, uri)
		if (wfName) {
			dir.label = wfName
		}
		dir.canResolveChildren = false
		dir.tags = [ new TestTag("runnable"), new TestTag("ABLTestDir") ]

		const data = new ABLTestDir(dir.uri!)
		testData.set(dir, data)

		if (parent) {
			parent.children.add(dir)
		} else {
			controller.items.add(dir)
			if (suiteGroup) {
				dir.children.add(suiteGroup)
				dir = suiteGroup
			}
		}
		parent = dir
	}
	return parent
}

function createFileNode(file: Uri) {
	const fileAttrs = getTestFileAttrs(file)
	if (fileAttrs === "none") {
		return undefined
	}

	if (fileAttrs === "suite") {
		return new ABLTestSuite()
	}

	if (file.fsPath.endsWith(".cls")) {
		return new ABLTestClass()
	}
	return new ABLTestProgram()
}

function getTestFileAttrs(file: Uri | undefined) {
	if (!file) {
		return "none"
	}
	const testRegex = /@test/i
	const suiteRegex = /@testsuite/i

	const contents = readFileSync(file.fsPath).toString()
	if (!contents || contents.length < 1 || !testRegex.test(contents)) {
		return "none"
	}

	if (suiteRegex.test(contents)) {
		return "suite"
	}
	return "other"
}

function gatherAllTestItems(collection: TestItemCollection) {
	const items: TestItem[] = []
	collection.forEach(item => {
		items.push(item)
		items.push(...gatherTestItems(item.children))
	})
	return items
}

function gatherTestItems(collection: TestItemCollection) {
	const items: TestItem[] = []
	for(const [, item] of collection) {
		items.push(item)
	}
	return items
}

function getExcludePatterns() {
	let excludePatterns: string[] = []

	const excludePatternsConfig: string[] | undefined = workspace.getConfiguration("ablunit").get("files.exclude")
	if (!excludePatternsConfig) {
		excludePatterns = [ "**/.builder/**" ]
	} else if (excludePatternsConfig[0].length == 1) {
		excludePatterns[0] = ''
		for (const pattern of excludePatternsConfig) {
			excludePatterns[0] = excludePatterns[0] + pattern
		}
	} else {
		excludePatterns = excludePatternsConfig
	}
	let retVal: RelativePattern[] = []

	workspace.workspaceFolders!.map(workspaceFolder => {
		retVal = retVal.concat(excludePatterns.map(pattern => new RelativePattern(workspaceFolder, pattern)))
	})
	return retVal
}

function getWorkspaceTestPatterns() {
	let includePatterns: string[] = []
	let excludePatterns: string[] = []

	const includePatternsConfig: string[] | undefined = workspace.getConfiguration("ablunit").get("files.include")
	if (!includePatternsConfig) {
		includePatterns = [ "**/*.{cls,p}" ]
	} else if (includePatternsConfig[0].length == 1) {
		includePatterns[0] = ''
		for (const pattern of includePatternsConfig) {
			includePatterns[0] = includePatterns[0] + pattern
		}
	} else {
		includePatterns = includePatternsConfig
	}

	const excludePatternsConfig: string[] | undefined = workspace.getConfiguration("ablunit").get("files.exclude")
	if (!excludePatternsConfig) {
		excludePatterns = [ "**/.builder/**" ]
	} else if (excludePatternsConfig[0].length == 1) {
		excludePatterns[0] = ''
		for (const pattern of excludePatternsConfig) {
			excludePatterns[0] = excludePatterns[0] + pattern
		}
	} else {
		excludePatterns = excludePatternsConfig
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

function deleteTest(controller: TestController | undefined, item: TestItem) {
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
		throw new Error("deleteTest failed - could not find parent for item: " + item.id)
	}
}

function deleteChildren(controller: TestController | undefined, item: TestItem) {
	for (const child of gatherTestItems(item.children)) {
		deleteChildren(controller, child)
		child.children.delete(item.id)
		testData.delete(child)
	}
}

function removeExcludedFiles(controller: TestController, excludePatterns: RelativePattern[]) {
	const items = gatherAllTestItems(controller.items)

	for (const element of items) {
		const item = element
		const data = testData.get(item)
		if (item.id === "ABLTestSuiteGroup") {
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

function removeExcludedChildren(parent: TestItem, excludePatterns: RelativePattern[]) {
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

async function findInitialFiles(controller: TestController,
								workspaceFolder: WorkspaceFolder,
								includePatterns: RelativePattern[],
								excludePatterns: RelativePattern[],
								removeExcluded: boolean = false) {
	const findAllFilesAtStartup = workspace.getConfiguration('ablunit').get('findAllFilesAtStartup')

	if (!findAllFilesAtStartup) {
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

function startWatchingWorkspace(controller: TestController, fileChangedEmitter: EventEmitter<Uri> ) {

	return getWorkspaceTestPatterns().map(({ workspaceFolder, includePatterns, excludePatterns }) => {

		const watchers = []

		for (const includePattern of includePatterns) {
			const watcher = workspace.createFileSystemWatcher(includePattern)

			watcher.onDidCreate(async uri => {
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
	}).flat()

}

function decorate(editor: TextEditor) {
	const executedArray: DecorationOptions[] = []
	const executableArray: DecorationOptions[] = []

	if(!recentResults || recentResults.length == 0) { return }

	const wf = workspace.getWorkspaceFolder(editor.document.uri)
	const idx = recentResults.findIndex(r => r.workspaceFolder === wf)
	if (idx < 0) { return }

	const tc = recentResults[idx].testCoverage.get(editor.document.uri.fsPath)
	if (!tc) { return }

	tc.detailedCoverage?.forEach(element => {
		const range = <Range> element.location
		const decoration = { range }
		if (element.executionCount > 0) {
			executedArray.push(decoration)
		} else {
			executableArray.push(decoration)
		}
	})

	editor.setDecorations(backgroundExecuted, executedArray)
	editor.setDecorations(backgroundExecutable, executableArray)
}

function openCallStackItem(traceUriStr: string) {
	const traceUri = Uri.parse(traceUriStr.split("&")[0])
	const traceLine = Number(traceUriStr.split("&")[1])
	window.showTextDocument(traceUri).then(editor => {
		const lineToGoBegin = new Position(traceLine,0)
		const lineToGoEnd = new Position(traceLine + 1,0)
		editor.selections = [new Selection(lineToGoBegin, lineToGoEnd)]
		const range = new Range(lineToGoBegin, lineToGoEnd)
		decorate(editor)
		editor.revealRange(range)
	})
}

function showNotification(message: string) {
	console.log("[showNotification] " + message)
	if (workspace.getConfiguration('ablunit').get('notificationsEnabled', true)) {
		window.showInformationMessage(message)
	}
}

function isFileExcluded(uri: Uri, excludePatterns: RelativePattern[]) {
	const patterns = excludePatterns.map(pattern => pattern.pattern)
	const relativePath = workspace.asRelativePath(uri.fsPath, false)
	const workspaceFolder = workspace.getWorkspaceFolder(uri)
	if (!workspaceFolder) {
		return true
	}
	const g = new GlobSync(relativePath, { cwd: workspaceFolder.uri.fsPath, ignore: patterns })
	return g.found.length == 0
}

////////// DEBUG FUNCTIONS //////////

function printDataType(data: any) {
	if (data instanceof ABLTestFile)
		logToChannel(" - ABLTestFile")
	if (data instanceof ABLTestCase)
		logToChannel(" - ABLTestCase")
	if (data instanceof ABLTestSuite)
		logToChannel(" - ABLTestSuite")
	else if(data instanceof ABLTestClass)
		logToChannel(" - ABLTestClass")
	else if(data instanceof ABLTestMethod)
		logToChannel(" - ABLTestMethod")
	else if(data instanceof ABLTestProgram)
		logToChannel(" - ABLTestProgram")
	else if(data instanceof ABLTestProcedure)
		logToChannel(" - ABLTestProcedure")
	else
		logToChannel(" - unexpected instanceof type")
}

function createDir(uri: Uri) {
	if(!uri) {
		return
	}
	return workspace.fs.stat(uri).then((stat) => {
		if (!stat) {
			logToChannel("create dir for extension storage: " + uri.fsPath)
			return workspace.fs.createDirectory(uri)
		}
	}, () => {
		logToChannel("create dir for extension storage: " + uri.fsPath)
		return workspace.fs.createDirectory(uri)
	})
}
