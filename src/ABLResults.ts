import { FileType, MarkdownString, Range, TestItem, TestItemCollection, TestMessage, TestRun, Uri, workspace, WorkspaceFolder } from 'vscode'
import { ABLUnitConfig } from './ABLUnitConfigWriter'
import { ABLResultsParser, ITestCaseFailure, ITestCase, ITestSuite } from './parse/ResultsParser'
import { ABLTestSuite, ABLTestData } from './testTree'
import { parseCallstack } from './parse/CallStackParser'
import { ABLProfile, ABLProfileJson, Module } from './parse/ProfileParser'
import { ABLDebugLines } from './ABLDebugLines'
import { ABLPromsgs, getPromsgText } from './ABLPromsgs'
import { PropathParser } from './ABLPropath'
import { log, logToChannel } from './ABLUnitCommon'
import { FileCoverage, CoveredCount, StatementCoverage } from './TestCoverage'
import { ablunitRun } from './ABLUnitRun'
import { getDLC, IDlc } from './parse/OpenedgeProjectParser'

export interface ITestObj {
	test: string
	cases?: string[]
}

export interface IABLUnitJson {
	options: {
		output: {
			location: string // results.xml directory
			filename: string // <filename>.xml
			format: 'xml'
		}
		quitOnEnd: boolean
		writeLog: boolean
		showErrorMessage: boolean
		throwError: boolean
	}
	tests: ITestObj[]
}

export class ABLResults {
	workspaceFolder: WorkspaceFolder
	storageUri: Uri
	globalStorageUri: Uri
	extensionResourcesUri: Uri
	wrapperUri: Uri
	status: string = "none"
	cfg: ABLUnitConfig
	startTime: Date
	endTime!: Date
	duration = () => { return (Number(this.endTime) - Number(this.startTime)) }

	ablResults: ABLResultsParser | undefined
	tests: TestItem[] = []
	testQueue: ITestObj[] = []
	testData!: WeakMap<TestItem, ABLTestData>
	skippedTests: TestItem[] = []
	propath?: PropathParser
	debugLines?: ABLDebugLines
	promsgs?: ABLPromsgs
	profileJson?: ABLProfileJson
	coverageJson: [] = []
	coverage: FileCoverage[] = []
	dlc: IDlc | undefined
	public testCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()

	constructor (workspaceFolder: WorkspaceFolder, storageUri: Uri, globalStorageUri: Uri, extensionResourcesUri: Uri) {
		logToChannel("workspaceFolder=" + workspaceFolder.uri.fsPath)
		this.startTime = new Date()
		this.workspaceFolder = workspaceFolder
		this.storageUri = storageUri
		this.globalStorageUri = globalStorageUri
		this.extensionResourcesUri = extensionResourcesUri
		this.wrapperUri = Uri.joinPath(this.extensionResourcesUri, 'ABLUnitCore-wrapper.p')
		this.cfg = new ABLUnitConfig()
		this.setStatus("constructed")
	}

	setStatus (status: string) {
		this.status = status
		logToChannel("STATUS: " + status)
	}

	setTestData (testData: WeakMap<TestItem, ABLTestData>) {
		this.testData = testData
	}

	async start () {
		log.info("[start] workspaceFolder=" + this.workspaceFolder.uri.fsPath)
		this.cfg.setup(this.workspaceFolder)

		this.dlc = getDLC(this.workspaceFolder)
		this.promsgs = new ABLPromsgs(this.dlc, this.globalStorageUri)

		this.propath = this.cfg.readPropathFromJson()
		this.debugLines = new ABLDebugLines(this.propath)

		const prom: (Promise<void> | Promise<void[]>)[] = []
		prom[0] = this.cfg.createProfileOptions(this.cfg.ablunitConfig.profOptsUri,this.cfg.ablunitConfig.profiler)
		prom[1] = this.cfg.createProgressIni(this.propath.toString())
		prom[2] = this.cfg.createAblunitJson(this.cfg.ablunitConfig.config_uri, this.cfg.ablunitConfig.options, this.testQueue)
		prom[3] = this.cfg.createDbConnPf(this.cfg.ablunitConfig.dbConnPfUri, this.cfg.ablunitConfig.dbConns)

		if(this.cfg.ablunitConfig.dbConns) {
			this.cfg.ablunitConfig.dbAliases = []
			for (const conn of this.cfg.ablunitConfig.dbConns) {
				if (conn.aliases.length > 0) {
					this.cfg.ablunitConfig.dbAliases.push(conn.name + ',' + conn.aliases.join(","))
				}
			}
		}

		return Promise.all(prom).then(() => {
			console.log("done creating config files for run")
		}, (err) => {
			console.error("ABLResults.start() did not complete promises. err=" + err)
		})
	}

	resetTests () {
		this.tests = []
	}

	async addTest (test:  TestItem, options: TestRun) {
		if (!test.uri) {
			logToChannel('test.uri is undefined (test.label = ' + test.label + ')', 'error', options)
			return
		}
		if (!this.propath) {
			throw new Error("propath is undefined")
		}

		const testPropath = await this.propath.search(test.uri)
		if (!testPropath) {
			this.skippedTests.push(test)
			logToChannel("skipping test, not found in propath: " + workspace.asRelativePath(test.uri), 'warn', options)
			return
		}

		log.debug("addTest: " + test.id + ", propathEntry=" + testPropath.propathEntry.path)
		this.tests.push(test)

		let testCase = undefined
		if (test.id.indexOf("#") > -1) {
			testCase = test.id.split("#")[1]
		}

		const testUri = test.uri
		let testRel: string = workspace.asRelativePath(testUri, false)
		const p = await this.propath.search(testUri)
		testRel = p?.propathRelativeFile ?? testRel.replace(/\\/g, '/')

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
			logToChannel("test already exists in configJson.tests: " + testRel, 'warn')
		} else {
			this.testQueue.push(testObj)
		}
	}

	async deleteResultsXml () {
		if (this.cfg.ablunitConfig.optionsUri.jsonUri) {
			const jsonUri = this.cfg.ablunitConfig.optionsUri.jsonUri
			await workspace.fs.stat(jsonUri).then((stat) => {
				if (stat.type === FileType.File) {
					logToChannel("delete " + jsonUri.fsPath)
					return workspace.fs.delete(jsonUri)
				}
			}, () => {
				// do nothing, can't delete a file that doesn't exist
			})
		}
		return workspace.fs.stat(this.cfg.ablunitConfig.optionsUri.filenameUri).then((stat) => {
			if (stat.type === FileType.File) {
				return workspace.fs.delete(this.cfg.ablunitConfig.optionsUri.filenameUri)
			}
		}, () => {
			// do nothing, can't delete a file that doesn't exist
		})
	}

	async run (options: TestRun) {
		await this.deleteResultsXml()
		return ablunitRun(options, this).then(() => {
			if(!this.ablResults!.resultsJson) {
				throw new Error("no results available")
			}
		}, (err) => {
			throw new Error("[ABLResults run] Exception: " + err)
		})
	}

	async parseOutput (options: TestRun) {
		this.setStatus("parsing results")
		logToChannel("parsing results from " + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath, 'info', options)

		this.endTime = new Date()

		this.ablResults = new ABLResultsParser(this.propath!, this.debugLines!)
		await this.ablResults.parseResults(this.cfg.ablunitConfig.optionsUri.filenameUri, this.cfg.ablunitConfig.optionsUri.jsonUri).then(() => {
			if(!this.ablResults!.resultsJson) {
				logToChannel("No results found in " + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath,"error", options)
				throw (new Error("[ABLResults parseOutput] No results found in " + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath + "\r\n"))
			}
			return true
		}, (err) => {
			this.setStatus("error parsing results data")
			logToChannel("Error parsing ablunit results from " + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath + ".  err=" + err,"error",options)
			throw (new Error("[ABLResults parseOutput] Error parsing ablunit results from " + this.cfg.ablunitConfig.optionsUri.filenameUri.fsPath + "\r\nerr=" + err))
		})

		if (this.cfg.ablunitConfig.profiler.enabled) {
			this.setStatus("parsing profiler data")
			logToChannel("parsing profiler data from " + this.cfg.ablunitConfig.profFilenameUri.fsPath, 'info', options)
			await this.parseProfile().then(() => {
				return true
			}, (err) => {
				this.setStatus("error parsing profiler data")
				logToChannel("Error parsing profiler data from " + this.cfg.ablunitConfig.profFilenameUri.fsPath + ".  err=" + err, "error", options)
				throw new Error("[ABLResults parseOutput] Error parsing profiler data from " + this.cfg.ablunitConfig.profFilenameUri.fsPath + "\r\nerr=" + err)
			})
		}

		this.setStatus("parsing output complete")
		logToChannel("parsing output complete")
		options.appendOutput("parsing output complete\r\n")
	}

	async assignTestResults (item: TestItem, options: TestRun) {

		if (this.skippedTests.indexOf(item) > -1) {
			options.skipped(item)
			return
		}
		if(!this.ablResults) {
			throw new Error("no ABLResults object initialized")
		}

		if(this.ablResults.resultsJson.length > 1) {
			logToChannel("multiple results files found - this is not supported")
			options.errored(item, new TestMessage("multiple results files found - this is not supported"), this.duration())
			return
		}

		if (!this.ablResults.resultsJson[0].testsuite) {
			logToChannel("no tests results available, check the configuration for accuracy")
			options.errored(item, new TestMessage("no tests results available, check the configuration for accuracy"), this.duration())
			return
		}

		const suiteName = await this.getSuiteName(item)
		const s = this.ablResults.resultsJson[0].testsuite.find((s: ITestSuite) => s.classname === suiteName || s.name === suiteName)
		if (!s) {
			logToChannel("could not find test suite for '" + suiteName + "' in results", 'error')
			options.errored(item, new TestMessage("could not find test suite for '" + suiteName + "' in results"), this.duration())
			return
		}

		const data = this.testData.get(item)
		if (data instanceof ABLTestSuite) {
			if (!s.testsuite) {
				console.error("no child testsuites found for " + suiteName)
				options.errored(item, new TestMessage("no child testsuites found for " + suiteName), this.duration())
				return
			}
			if (item.children.size > 0) {
				await this.parseChildSuites(item, s.testsuite, options)
			} else {
				if (s.errors > 0) {
					options.errored(item,new TestMessage("errors = " + s.errors + ", failures = " + s.failures + ", passed = " + s.passed))
				} else if (s.failures) {
					options.failed(item, new TestMessage("failures = " + s.failures + ", passed = " + s.passed))
				} else if (s.skipped) {
					options.skipped(item)
				} else {
					options.passed(item)
				}
			}
		} else {
			return this.parseFinalSuite(item, s, options)
		}
	}

	async parseChildSuites (item: TestItem, s: ITestSuite[], options: TestRun) {
		for (const t of s) {
			// find matching child TestItem
			let child = item.children.get(t.name!)
			if (!child) {
				child = item.children.get(t.classname!)
			}

			// parse results for the child TestItem, if it exists
			if (child) {
				await this.parseFinalSuite(child, t, options)
			} else {
				console.error("could not find child test item for " + t.name + " or " + t.classname)
				// throw new Error("could not find child test item for " + t.name + " or " + t.classname)
			}
		}
	}

	private async parseFinalSuite (item: TestItem, s: ITestSuite, options: TestRun) {
		if (s.tests > 0) {
			if (s.errors === 0 && s.failures === 0) {
				options.passed(item, s.time)
			} else if (s.tests === s.skipped) {
				options.skipped(item)
			} else if (s.failures > 0 || s.errors > 0) {
				// // This should be populated automatically by the child messages filtering up
				// options.failed(item, new vscode.TestMessage("one or more tests failed"), s.time)
			} else {
				logToChannel("unknown error - test results are all zero")
				options.errored(item, new TestMessage("unknown error - test results are all zero"), s.time)
			}
		}

		if (!s.testcases) {
			logToChannel("no test cases discovered or run - check the configuration for accuracy")
			options.errored(item, new TestMessage("no test cases discovered or run - check the configuration for accuracy"), this.duration())
			return
		}

		return this.setAllChildResults(item.children, s.testcases, options)
	}

	private async getSuiteName (item: TestItem) {
		let suitePath = workspace.asRelativePath(item.uri!, false)

		if(suitePath) {
			const propathRelativePath = this.propath!.search(suitePath)!
			suitePath = await propathRelativePath.then((res) => {
				if (res?.propathRelativeFile) {
					return res?.propathRelativeFile
				}
				return suitePath
			})
		}
		suitePath = suitePath.replace(/\\/g, '/')
		return suitePath
	}

	private async setAllChildResults (children: TestItemCollection, testcases: ITestCase[], options: TestRun) {
		const promArr: Promise<void>[] = [Promise.resolve()]
		children.forEach(child => {
			const tc = testcases.find((t: ITestCase) => t.name === child.label)
			if (!tc) {
				logToChannel("could not find result for test case '" + child.label + "'", "error")
				options.errored(child, new TestMessage("could not find result for test case '" + child.label + "'"))
				return
			}
			promArr.push(this.setChildResults(child, options, tc))
		})

		return Promise.all(promArr)
	}

	private async setChildResults (item: TestItem, options: TestRun, tc: ITestCase) {
		switch (tc.status) {
			case "Success": {
				options.passed(item, tc.time)
				return
			}
			case "Failure": {
				if (tc.failure) {
					const diff = this.getDiffMessage(tc.failure)
					return this.getFailureMarkdownMessage(item, options, tc.failure).then((msg) => {
						const tmArr: TestMessage[] = [ new TestMessage(msg) ]
						if (diff) {
							tmArr.push(diff)
						}
						options.failed(item, tmArr, tc.time)
					})
				}
				throw new Error("unexpected failure for '" + tc.name)
			}
			case "Error": {
				if (tc.failure) {
					return this.getFailureMarkdownMessage(item, options, tc.failure).then((msg) => {
						const tm = new TestMessage(msg)
						options.failed(item, [ tm ], tc.time)
					})
				}
				throw new Error("unexpected error for " + tc.name)
			}
			case "Skpped": {
				options.skipped(item)
				return
			}
			default: {
				throw new Error("unexpected test status " + tc.status + " for " + tc.name)
			}
		}
	}

	private async getFailureMarkdownMessage (item: TestItem, options: TestRun, failure: ITestCaseFailure): Promise<MarkdownString> {
		const stack = await parseCallstack(this.debugLines!, failure.callstackRaw)
		const promsg = getPromsgText(failure.message)
		const md = new MarkdownString(promsg + "\n\n")

		if (stack.markdownText) {
			md.appendMarkdown(stack.markdownText)
			md.isTrusted = {
				enabledCommands: [ "_ablunit.openCallStackItem" ]
			}
			for(const stackItem of stack.items) {
				if(stackItem.loc) {
					options.appendOutput(item.label + " failed! " + failure.message + "\r\n", stackItem.loc)
				}
			}
		} else {
			md.appendMarkdown(promsg + "\n\n**ABL Call Stack**\n\n<code>\n" + failure.callstackRaw.replace(/\r/g,'\n') + "\n</code>")
		}
		md.supportHtml = true
		return md
	}

	private getDiffMessage (failure: ITestCaseFailure) {
		if (!failure.diff) {
			return undefined
		}
		const tm = TestMessage.diff("Assert failed! ", failure.diff.expectedOutput, failure.diff.actualOutput)
		for (const line of failure.callstack.items) {
			if (line.loc) {
				tm.location = line.loc
			}
		}
		return tm
	}

	async parseProfile () {
		const profParser = new ABLProfile()
		return profParser.parseData(this.cfg.ablunitConfig.profFilenameUri, this.cfg.ablunitConfig.profiler.writeJson, this.debugLines!).then(() => {
			this.profileJson = profParser.profJSON
			return this.assignProfileResults().then(() => {
				console.log("assignProfileResults complete")
			}, (err) => {
				throw new Error("assignProfileResults error: " + err)
			})
		})
	}

	async assignProfileResults () {
		if (!this.profileJson) {
			throw (new Error("no profile data available..."))
		}
		const mods: Module[] = this.profileJson.modules
		for (let idx=1; idx < mods.length; idx++) {
			const module = mods[idx]
			if (!module.SourceName) {
				continue
			}
			await this.setCoverage(module).then()
		}
	}

	async setCoverage (module: Module) {
		const fileinfo = await this.propath!.search(module.SourceName)
		const moduleUri = fileinfo?.uri
		if (!moduleUri) {
			if (!module.SourceName.startsWith("OpenEdge.")) {
				console.error("could not find moduleUri for " + module.SourceName)
			}
			return
		}
		module.SourceUri = fileinfo.uri
		let fc: FileCoverage | undefined

		for (let idx=0; idx < module.lines.length; idx++) { // NOSONAR
			const line = module.lines[idx]
			if (line.LineNo <= 0) {
				//  * -2 is a special case - need to handgle this better
				//  *  0 is a special case - method header
				continue
			}

			const dbg = await this.debugLines!.getSourceLine(fileinfo.propathRelativeFile, line.LineNo)
			if (!dbg) {
				return
			}

			if (fc?.uri.fsPath != dbg.sourceUri.fsPath) {
				// get existing FileCoverage object
				fc = this.testCoverage.get(dbg.sourceUri.fsPath)
				if (!fc) {
					// create a new FileCoverage object if one didn't already exist
					fc = new FileCoverage(dbg.sourceUri, new CoveredCount(0, 0))
					fc.detailedCoverage = []
					this.coverage.push(fc)
					this.testCoverage.set(dbg.sourceUri.fsPath, fc)
				}
			}

			fc.detailedCoverage!.push(new StatementCoverage(line.ExecCount ?? 0,
				new Range(dbg.sourceLine - 1, 0, dbg.sourceLine, 0)))
		}
	}
}
