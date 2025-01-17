import { FileType, MarkdownString, TestItem, TestItemCollection, TestMessage, TestRun, Uri, workspace, WorkspaceFolder,
	FileCoverage, FileCoverageDetail,
	Disposable, CancellationToken, CancellationError,
	Position, Range,
	DeclarationCoverage, StatementCoverage,
	TestRunRequest, TestRunProfileKind} from 'vscode'
import { ABLUnitConfig } from './ABLUnitConfigWriter'
import { ABLResultsParser, ITestCaseFailure, ITestCase, ITestSuite } from './parse/ResultsParser'
import { ABLTestSuite, ABLTestData, ABLTestCase } from './testTree'
import { parseCallstack } from './parse/CallStackParser'
import { ABLProfile, ABLProfileJson, checkSkipList, getModuleRange, IModule } from './parse/ProfileParser'
import { ABLDebugLines } from './ABLDebugLines'
import { ABLPromsgs, getPromsgText } from './ABLPromsgs'
import { PropathParser } from './ABLPropath'
import { log } from './ChannelLogger'
import { RunStatus, ablunitRun } from './ABLUnitRun'
import { getDLC, IDlc } from './parse/OpenedgeProjectParser'
import { Duration } from './ABLUnitCommon'
import { ITestObj } from 'parse/config/CoreOptions'
import * as FileUtils from './FileUtils'
import { basename, dirname } from 'path'
import { globSync } from 'glob'
import { ABLUnitRuntimeError, TimeoutError } from 'Errors'

export class ABLResults implements Disposable {
	workspaceFolder: WorkspaceFolder
	wrapperUri: Uri
	status = RunStatus.None
	statusNote: string | undefined
	cfg: ABLUnitConfig
	duration: Duration
	ablResults: ABLResultsParser | undefined
	tests: TestItem[] = []
	testQueue: ITestObj[] = []
	testData = new WeakMap<TestItem, ABLTestData>()
	skippedTests: TestItem[] = []
	propath: PropathParser
	debugLines: ABLDebugLines
	promsgs: ABLPromsgs
	profileJson: ABLProfileJson[] = []
	coverageJson: [] = []
	dlc: IDlc
	thrownError: Error | undefined

	public fileCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()
	public fileCoverageDetail: FileCoverageDetail[] = []
	public declarationCoverage: Map<string, DeclarationCoverage[]> = new Map<string, DeclarationCoverage[]>()
	public statementCoverage: Map<string, StatementCoverage[]> = new Map<string, StatementCoverage[]>()

	constructor (workspaceFolder: WorkspaceFolder,
		private readonly storageUri: Uri,
		private readonly globalStorageUri: Uri,
		private readonly extensionResourcesUri: Uri,
		private readonly request: TestRunRequest,
		private readonly cancellation: CancellationToken)
	{
		log.info('workspaceFolder=' + workspaceFolder.uri.fsPath)
		cancellation.onCancellationRequested(() => {
			log.debug('cancellation requested - ABLResults')
			throw new CancellationError()
		})
		this.duration = new Duration()
		this.workspaceFolder = workspaceFolder
		this.wrapperUri = Uri.joinPath(this.extensionResourcesUri, 'VSCodeTestRunner', 'ABLUnitCore.p')
		this.cfg = new ABLUnitConfig()
		this.cfg.setup(this.workspaceFolder, this.request)
		this.dlc = getDLC(this.workspaceFolder, this.cfg.ablunitConfig.openedgeProjectProfile)
		this.promsgs = new ABLPromsgs(this.dlc, this.globalStorageUri)
		this.propath = this.cfg.readPropathFromJson(this.extensionResourcesUri)
		this.debugLines = new ABLDebugLines(this.propath)

		this.cfg.ablunitConfig.dbAliases = []
		if (this.cfg.ablunitConfig.dbConns && this.cfg.ablunitConfig.dbConns.length > 0) {
			for (const conn of this.cfg.ablunitConfig.dbConns) {
				if (conn.aliases.length > 0) {
					this.cfg.ablunitConfig.dbAliases.push(conn.name + ',' + conn.aliases.join(','))
				}
			}
		}

		this.setStatus(RunStatus.Constructed)
	}

	dispose () {
		this.setStatus(RunStatus.Cancelled, 'disposing ABLResults object')
		delete this.ablResults
	}

	setStatus (status: RunStatus, statusNote?: string) {
		if (this.status === RunStatus.Cancelled) {
			log.debug('cancellation requested - ignoring setStatus() call')
			throw new CancellationError()
		}
		this.status = status
		this.statusNote = statusNote
		log.info('STATUS: ' + status)
	}

	setTestData (testData: WeakMap<TestItem, ABLTestData>) {
		this.testData = testData
	}

	start () {
		log.info('[start] workspaceFolder=' + this.workspaceFolder.uri.fsPath)

		// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
		const proms: (Thenable<void> | Promise<void> | Promise<void[]> | undefined)[] = []
		this.cfg.createProfileOptions(this.cfg.ablunitConfig.profOptsUri, this.cfg.ablunitConfig.profiler)
		this.cfg.createDbConnPf(this.cfg.ablunitConfig.dbConnPfUri, this.cfg.ablunitConfig.dbConns)
		proms.push(this.cfg.createProgressIni(this.propath.toString(), this.dlc))
		proms.push(this.cfg.createAblunitJson(this.cfg.ablunitConfig.config_uri, this.cfg.ablunitConfig.options, this.testQueue))

		return Promise.all(proms).then(() => {
			log.info('done creating config files for run')
			return
		}, (e: unknown) => {
			log.error('ABLResults.start() did not complete promises. e=' + e)
		})
	}

	resetTests () {
		this.tests = []
	}

	async addTest (test:  TestItem, data: ABLTestData, options: TestRun) {
		if (!test.uri) {
			log.error('test.uri is undefined (test.label = ' + test.label + ')', options)
			return
		}
		if (!this.propath) {
			throw new Error('propath is undefined')
		}

		const testPropath = await this.propath.search(test.uri)
		if (!testPropath) {
			this.skippedTests.push(test)
			log.warn('skipping test, not found in propath: ' + workspace.asRelativePath(test.uri), options)
			return
		}

		let propathEntryTestFile = testPropath.propathEntry.path
		if (FileUtils.isRelativePath(testPropath.propathEntry.path)) {
			propathEntryTestFile = workspace.asRelativePath(Uri.joinPath(this.workspaceFolder.uri, testPropath.propathEntry.path))
		}
		log.debug('addTest: ' + test.id + ', propathEntry=' + propathEntryTestFile)
		this.tests.push(test)
		this.testData.set(test, data)

		let testCase: string | undefined = undefined
		if (data instanceof ABLTestCase) {
			testCase = test.label
		}

		const testUri = test.uri
		let testRel: string = workspace.asRelativePath(testUri, false)
		const p = await this.propath.search(testUri)
		testRel = (p?.propathRelativeFile ?? testRel).replace(/\\/g, '/')

		const testObj: ITestObj = { test: testRel }
		if (testCase) {
			testObj.cases = [ testCase ]
		}

		const existingTestObj = this.testQueue.find((t: ITestObj) => t.test === testRel)
		if (testCase && existingTestObj) {
			if(testObj.cases) {
				if (!existingTestObj.cases) {
					existingTestObj.cases = []
				}
				existingTestObj.cases.push(testCase)
			}
			return
		}

		if (this.testQueue.find((t: ITestObj) => t.test === testRel)) {
			log.warn('test already exists in configJson.tests: ' + testRel)
		} else {
			this.testQueue.push(testObj)
		}
	}

	async deleteResultsXml () {
		if (this.cfg.ablunitConfig.optionsUri.jsonUri) {
			const jsonUri = this.cfg.ablunitConfig.optionsUri.jsonUri
			await workspace.fs.stat(jsonUri).then((stat) => {
				if (stat.type === FileType.File) {
					log.info('delete ' + jsonUri.fsPath)
					return workspace.fs.delete(jsonUri)
				}
				return
			}, () => {
				// do nothing, can't delete a file that doesn't exist
			})
		}
		return workspace.fs.stat(this.cfg.ablunitConfig.optionsUri.filenameUri).then((stat) => {
			if (stat.type === FileType.File) {
				return workspace.fs.delete(this.cfg.ablunitConfig.optionsUri.filenameUri)
			}
			return
		}, () => {
			// do nothing, can't delete a file that doesn't exist
		})
	}

	async run (options: TestRun) {
		await this.deleteResultsXml()
		return ablunitRun(options, this, this.cancellation).then(() => {
			if(!this.ablResults?.resultsJson) {
				throw new Error('no results available')
			}
			return true
		}, (e: unknown) => {
			if (e instanceof CancellationError || e instanceof ABLUnitRuntimeError || e instanceof TimeoutError || e instanceof Error) {
				throw e
			}
			throw new Error('ablunit run failed! Exception not instance of Error.  e=: ' + e)
		})
	}

	async parseOutput (options: TestRun) {
		this.setStatus(RunStatus.Parsing, 'results')
		log.debug('parsing results from ' + workspace.asRelativePath(this.cfg.ablunitConfig.optionsUri.filenameUri), options)

		this.duration.stop()
		const parseTime = new Duration()

		this.ablResults = new ABLResultsParser(this.propath, this.debugLines)
		await this.ablResults.parseResults(this.cfg.ablunitConfig.optionsUri.filenameUri, this.cfg.ablunitConfig.optionsUri.jsonUri).then(() => {
			log.info('parsing results complete ' + parseTime.toString())
			if(!this.ablResults?.resultsJson) {
				log.error('No results found in ' + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath, options)
				throw new Error('No results found in ' + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath + '\r\n')
			}
			return true
		}, (e: unknown) => {
			this.setStatus(RunStatus.Error, 'parsing results')
			log.error('Error parsing results from ' + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath + '.  e=' + e, options)
			throw new Error('Error parsing results from ' + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath + '\r\ne=' + e)
		})

		if (this.request.profile?.kind === TestRunProfileKind.Coverage && this.cfg.ablunitConfig.profiler.enabled && this.cfg.ablunitConfig.profiler.coverage) {
			this.setStatus(RunStatus.Parsing, 'profiler data')
			log.info('parsing profiler data...', options)
			await this.parseProfile(options).then(() => {
				log.info('parsing profiler data complete ' + parseTime.toString())
				return true
			}, (e: unknown) => {
				this.setStatus(RunStatus.Error, 'profiler data')
				log.error('Error parsing profiler data from ' + this.cfg.ablunitConfig.profFilenameUri.fsPath + '.  e=' + e, options)
				if (e instanceof Error) {
					log.error('e.stack=' + e.stack)
				}
				throw new Error('Error parsing profiler data from ' + workspace.asRelativePath(this.cfg.ablunitConfig.profFilenameUri) + '\r\ne=' + e)
			})
		}

		this.setStatus(RunStatus.Complete, 'parsing output complete ' + parseTime.toString())
		log.info('parsing output complete ' + parseTime.toString())
	}

	async assignTestResults (item: TestItem, options: TestRun) {

		if (this.skippedTests.includes(item)) {
			log.warn('skipped test item \'' + item.label + '\'')
			options.skipped(item)
			return
		}
		if(!this.ablResults) {
			throw new Error('no ABLResults object initialized')
		}

		if(this.ablResults.resultsJson.length > 1) {
			log.info('multiple results files found - this is not supported (item=' + item.label + ')')
			options.errored(item, new TestMessage('multiple results files found - this is not supported'), this.duration.elapsed())
			return
		}

		if (!this.ablResults.resultsJson[0].testsuite) {
			log.info('no tests results available, check the configuration for accuracy (item=' + item.label + ')')
			options.errored(item, new TestMessage('no tests results available, check the configuration for accuracy'), this.duration.elapsed())
			return
		}

		const suiteName = await this.getSuiteName(item)
		const s = this.ablResults.resultsJson[0].testsuite.find((s: ITestSuite) => s.classname === suiteName || s.name === suiteName)
		if (!s) {
			log.error('could not find test suite for \'' + suiteName + '\' in results (item=' + item.label + ')')
			options.errored(item, new TestMessage('could not find test suite for \'' + suiteName + '\' in results'), this.duration.elapsed())
			return
		}

		const data = this.testData.get(item)
		if (data instanceof ABLTestSuite) {
			if (!s.testsuite) {
				log.error('no child testsuites found (item=' + item.label + ')')
				options.errored(item, new TestMessage('no child testsuites found for ' + suiteName), this.duration.elapsed())
				return
			}
			if (item.children.size > 0) {
				this.parseChildSuites(item, s.testsuite, options)
			}
			if (s.errors > 0) {
				log.error('errors = ' + s.errors + ', failures = ' + s.failures + ', passed = ' + s.passed + ' (item=' + item.label + ')')
				options.errored(item, new TestMessage('errors = ' + s.errors + ', failures = ' + s.failures + ', passed = ' + s.passed))
			} else if (s.failures) {
				log.error('failures = ' + s.failures + ', passed = ' + s.passed + ' (item=' + item.label + ')')
				options.failed(item, new TestMessage('failures = ' + s.failures + ', passed = ' + s.passed))
			} else if (s.skipped) {
				log.warn('skipped = ' + s.skipped + ', passed = ' + s.passed + ' (item=' + item.label + ')')
				options.skipped(item)
			} else {
				log.info('passed = ' + s.passed + ' (item=' + item.label + ')')
				options.passed(item)
			}
		} else {
			this.parseFinalSuite(item, s, options)

			if (s.errors > 0) {
				log.error('s.errors=' + s.errors)
				options.failed(item, new TestMessage(s.errors + ' errors'), this.duration.elapsed())
			} else if (s.failures > 0) {
				log.error('s.failures=' + s.failures)
				options.failed(item, new TestMessage(s.failures + ' failures'), this.duration.elapsed())
			} else if (s.skipped > 0) {
				log.warn('skipped test case \'' + item.label + '\'')
				options.skipped(item)
			} else if (s.passed > 0 && s.errors == 0 && s.failures == 0) {
				log.info('passed test case \'' + item.label + '\'')
				options.passed(item)
			}
		}
	}

	parseChildSuites (item: TestItem, s: ITestSuite[], options: TestRun) {
		for (const t of s) {
			// find matching child TestItem
			let child = item.children.get(t.name!)
			if (!child) {
				child = item.children.get(t.classname!)
			}

			// parse results for the child TestItem, if it exists
			if (child) {
				this.parseFinalSuite(child, t, options)
			} else {
				log.error('could not find child test item for ' + t.name + ' or ' + t.classname)
				// throw new Error("could not find child test item for " + t.name + " or " + t.classname)
			}
		}
	}

	private parseFinalSuite (item: TestItem, s: ITestSuite, options: TestRun) {
		if (!s.testcases) {
			log.error('no test cases discovered or run - check the configuration for accuracy (item: ' + item.id + ')', options)
			options.errored(item, new TestMessage('no test cases discovered or run - check the configuration for accuracy'), this.duration.elapsed())
			return
		}

		if (item.children.size > 0) {
			this.setAllChildResults(item.children, s.testcases, options)
		} else {
			this.setChildResults(item, options, s.testcases[0])
		}
	}

	private async getSuiteName (item: TestItem) {
		let suitePath = workspace.asRelativePath(item.uri!, false)

		if(suitePath) {
			const propathRelativePath = this.propath.search(suitePath)
			suitePath = await propathRelativePath.then((res) => {
				if (res?.propathRelativeFile) {
					return res.propathRelativeFile
				}
				return suitePath
			})
		}
		suitePath = suitePath.replace(/\\/g, '/')
		return suitePath
	}

	private setAllChildResults (children: TestItemCollection, testcases: ITestCase[], options: TestRun) {
		children.forEach(child => {
			const tc = testcases.find((t: ITestCase) => t.name === child.label)
			if (!tc) {
				log.error('could not find result for test case (item=' + child.label + ')')
				options.errored(child, new TestMessage('could not find result for test case \'' + child.label + '\''))
				return
			}
			this.setChildResults(child, options, tc)
		})
	}

	private setChildResults (item: TestItem, options: TestRun, tc: ITestCase) {
		switch (tc.status.toLowerCase()) {
			case 'success': {
				if (tc.skipped) {
					options.skipped(item)
				} else {
					options.passed(item, tc.time)
				}
				return
			}
			case 'failure':
			case 'error': {
				if (tc.failures && tc.failures.length > 0) {
					for (const failure of tc.failures) {
						const diff = this.getDiffMessage(failure)
						if (diff) {
							options.failed(item, diff, tc.time)
						} else {
							const testMessage = new TestMessage(getPromsgText(failure.message))
							testMessage.stackTrace = failure.stackTrace
							options.failed(item, testMessage, tc.time)
						}
					}
					return
				}
				log.error('unexpected ' + tc.status.toLowerCase() + ' for \'' + tc.name + '\'')
				throw new Error('unexpected ' + tc.status.toLowerCase() + ' for \'' + tc.name + '\'')
			}
			case 'skpped': {
				options.skipped(item)
				return
			}
			default: {
				log.error('unexpected test status ' + tc.status + ' for ' + tc.name)
				throw new Error('unexpected test status ' + tc.status + ' for ' + tc.name)
			}
		}
	}

	private async getFailureMarkdownMessage (item: TestItem, options: TestRun, failure: ITestCaseFailure): Promise<MarkdownString> {
		const stack = await parseCallstack(this.debugLines, failure.callstackRaw)
		const promsg = getPromsgText(failure.message)
		const md = new MarkdownString(promsg + '\n\n')

		if (stack.markdownText) {
			md.appendMarkdown(stack.markdownText)
			md.isTrusted = {
				enabledCommands: [ '_ablunit.openCallStackItem' ]
			}
			for(const stackItem of stack.items) {
				if(stackItem.loc) {
					options.appendOutput(item.label + ' failed! ' + failure.message + '\r\n', stackItem.loc)
				}
			}
		} else {
			md.appendMarkdown(promsg + '\n\n**ABL Call Stack**\n\n<code>\n' + failure.callstackRaw.replace(/\r/g, '\n') + '\n</code>')
		}
		md.supportHtml = true
		return md
	}

	private getDiffMessage (failure: ITestCaseFailure) {
		if (!failure.diff) {
			return undefined
		}
		const tm = TestMessage.diff(failure.message, failure.diff.expectedOutput, failure.diff.actualOutput)
		for (const line of failure.callstack.items) {
			if (!tm.location && line.loc) {
				tm.location = line.loc
			}
		}
		tm.stackTrace = failure.stackTrace
		return tm
	}

	findTest (profileDescription: string | undefined) {
		if (!profileDescription || profileDescription.split('|').length < 2) {
			return undefined
		}
		let parentName = profileDescription.split('|')[1].split(' ')[0]
		if (parentName.endsWith('.cls')) {
			parentName = parentName.substring(0, parentName.length - 4)
		}
		const testName = profileDescription.split('|')[1].split(' ')[1]

		const tests = []
		for (const t of this.tests) {
			tests.push(t)
			for (const [, child] of t.children) {
				tests.push(child)
			}
		}

		const item = tests.find((t) => {
			return t.parent?.label == parentName && t.label == testName
		})

		if (!item) {
			log.warn('could not find test item for parent=' + parentName + ', testName=' + testName)
			return undefined
		}
		return item
	}

	async parseProfile (options: TestRun) {
		const duration = new Duration()
		const profParser = new ABLProfile()
		const profDir = dirname(this.cfg.ablunitConfig.profFilenameUri.fsPath)
		const profFile = basename(this.cfg.ablunitConfig.profFilenameUri.fsPath)
		// <basename>.<ext> -> <basename>_*_*.<ext>
		const globPattern = profFile.replace(/(.+)\.([a-zA-Z]+)$/, '$1_*.$2')
		const dataFiles = [ basename(this.cfg.ablunitConfig.profFilenameUri.fsPath) ]
		try {
			dataFiles.push(...globSync(globPattern, { cwd: profDir }))
		} catch(e) {
			log.warn('globSync failed for ' + globPattern + '\n\te=' + e)
		}
		dataFiles.sort((a, b) => { return a.localeCompare(b) })

		for (let i=0; i < dataFiles.length; i++) {
			const uri = Uri.joinPath(Uri.file(profDir), dataFiles[i])
			log.info('parsing profile data ' + i + '/' + dataFiles.length + ' from ' + uri.fsPath, options)

			const prom = profParser.parseData(uri, this.cfg.ablunitConfig.profiler.writeJson, this.debugLines).then((profJson) => {
				const item = this.findTest(profJson.description)
				profJson.testItemId = item?.id
				this.profileJson.push(profJson)
				return this.assignProfileResults(profJson, item)
			}).then(() => {
				log.info('parsing profile data complete (' + i + '/' + dataFiles.length + ') ' + duration.toString())
				return true
			})
			await prom
		}
		log.info('parsing profile data complete ' + duration.toString(), options)
	}

	async assignProfileResults (profJson: ABLProfileJson, item: TestItem | undefined) {
		if (!profJson) {
			log.error('no profile data available...')
			throw new Error('no profile data available...')
		}
		for (const module of profJson.modules) {
			if (checkSkipList(module.SourceName)) {
				continue
			}
			await this.setCoverage(module, item)
		}
	}

	getExecCount (module: IModule) {
		const zeroLine = module.lines.find((a) => a.LineNo == 0)
		return zeroLine?.ExecCount ?? 0
	}

	addDeclarationFromModule (uri: Uri, module: IModule) {
		const fdc = this.declarationCoverage.get(uri.fsPath) ?? []

		let dc = fdc.find((c) => c.name == (module.EntityName ?? '<main block'))
		if (!dc) {
			const range = getModuleRange(module)
			if (range) {
				dc = new DeclarationCoverage(module.EntityName ?? '<main block>', 0, range)
				fdc.push(dc)
			}
		}
		if (dc?.name == '<main block>') {
			const executedLines = module.lines.filter((a) => a.ExecCount > 0)
			if (executedLines.length > 0) {
				dc.executed = true
			}
		} else if (typeof dc?.executed == 'number') {
			dc.executed = dc.executed + this.getExecCount(module)
		} else if (typeof dc?.executed == 'boolean') {
			dc.executed = dc.executed || this.getExecCount(module) > 0
		}

		this.declarationCoverage.set(uri.fsPath, fdc)
	}

	sortLocation (a: DeclarationCoverage | StatementCoverage, b: DeclarationCoverage | StatementCoverage) {
		let startPosA: Position
		let startPosB: Position
		let endPosA: Position | undefined
		let endPosB: Position | undefined

		if (a.location instanceof Position) {
			startPosA = a.location
		} else {
			startPosA = a.location.start
		}
		if (b.location instanceof Position) {
			startPosB = b.location
		} else {
			startPosB = b.location.start
		}

		const compStart = startPosA.compareTo(startPosB)
		if (compStart != 0) {
			return compStart
		}

		if (a.location instanceof Range) {
			endPosA = a.location.end
		}
		if (b.location instanceof Range) {
			endPosB = b.location.end
		}
		return endPosA?.compareTo(endPosB ?? startPosB) ?? 0
	}

	async setCoverage (module: IModule, item?: TestItem) {
		if (checkSkipList(module.SourceName)) {
			return
		}

		const fileinfo = await this.propath.search(module.SourceUri ?? module.SourceName)
		if (!fileinfo?.uri) {
			log.warn('could not find module in propath: ' + module.SourceName + ' (' + module.ModuleID + ')')
			return
		}

		const zeroLine = module.lines.find((a) => a.LineNo == 0)
		if (!zeroLine) {
			log.warn('could not find zeroLine for ' + module.SourceName)
		}

		for (const child of module.childModules) {
			this.addDeclarationFromModule(fileinfo.uri, child)
		}
		// ----- this next line would add the main block to the declaration coverage -----
		// this.addDeclarationFromModule(fileinfo.uri, module)

		const fsc = this.statementCoverage.get(fileinfo.uri.fsPath) ?? []
		if (fsc.length === 0) {
			this.statementCoverage.set(fileinfo.uri.fsPath, fsc)
		}

		const lines = module.lines
		for (const child of module.childModules) {
			lines.push(...child.lines.filter((l) => l.LineNo > 0))
		}

		for (const line of lines) {
			if (line.LineNo <= 0) { continue }
			const lineno = (line.incLine ?? line.LineNo) - 1
			const coverageRange = new Position(lineno, 0)

			let cov = fsc.find((c) => JSON.stringify(c.location) == JSON.stringify(coverageRange))
			if (!cov) {
				cov = new StatementCoverage(line.ExecCount ?? 0, coverageRange)
				fsc.push(cov)
			} else if (typeof cov.executed == 'number') {
				cov.executed = cov.executed + (line.ExecCount ?? 0)
			} else if (typeof cov.executed == 'boolean') {
				cov.executed = cov.executed || line.ExecCount > 0
			}
		}

		const fdc = this.declarationCoverage.get(fileinfo.uri.fsPath) ?? []
		fdc.sort((a, b) => this.sortLocation(a, b))
		fsc.sort((a, b) => this.sortLocation(a, b))

		const fcd: FileCoverageDetail[] = []
		fcd.push(...fdc, ...fsc)

		const fc = FileCoverage.fromDetails(fileinfo.uri, fcd)
		const fcOrig = this.fileCoverage.get(fileinfo.uri.fsPath)
		fc.includesTests = fcOrig?.includesTests ?? []
		if (item && !fc.includesTests.find((i) => i.id == item.id)) {
			fc.includesTests.push(item)
		}

		this.fileCoverage.set(fileinfo.uri.fsPath, fc)
	}
}
