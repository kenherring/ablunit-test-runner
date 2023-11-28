import { FileType, MarkdownString, Position, Range, TestItem, TestItemCollection, TestMessage, TestRun, Uri, workspace } from "vscode"
import { ABLUnitConfig, ablunitConfig } from "./ABLUnitConfigWriter"
import { ABLResultsParser, TCFailure, TestCase, TestSuite } from "./parse/ResultsParser"
import { ABLTestSuite, ABLUnitTestData } from "./testTree"
import { parseCallstack } from "./parse/CallStackParser"
import { ABLProfile, ABLProfileJson, Module } from "./parse/ProfileParser"
import { ABLDebugLines } from "./ABLDebugLines"
import { ABLPromsgs, getPromsgText } from "./ABLPromsgs"
import { PropathParser } from "./ABLPropath"
import { logToChannel } from "./ABLUnitCommon"
import { FileCoverage, CoveredCount, StatementCoverage } from "./TestCoverage"
import { ablunitRun } from "./ABLUnitRun"
import { getOEVersion } from "./parse/OpenedgeProjectParser"


export class ABLResults {
	public status: string = "none"
	private cfg: ABLUnitConfig
	startTime: Date
	endTime!: Date
	duration = () => { return (Number(this.endTime) - Number(this.startTime)) }

	ablResults: ABLResultsParser | undefined
	testData!: WeakMap<TestItem, ABLUnitTestData>
	propath?: PropathParser
	debugLines?: ABLDebugLines
	promsgs?: ABLPromsgs
	profileJson?: ABLProfileJson
	coverageJson: [] = []
	coverage: FileCoverage[] = []
	dlc: string | undefined
	public testCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()

	constructor(storageUri: Uri) {
		this.startTime = new Date()
		if (!workspace.workspaceFolders) {
			throw new Error("no workspace folder is open")
		}

		this.asyncConstructor(storageUri)

		const workspaceDir = workspace.workspaceFolders[0].uri
		this.cfg = new ABLUnitConfig(workspaceDir)
		ablunitConfig.workspaceUri = workspaceDir
		ablunitConfig.storageUri = storageUri
		if (ablunitConfig.tempDir === '') {
			this.cfg.setTempDirUri(storageUri)
		}
		this.setStatus("constructed")
	}

	async asyncConstructor(storageUri: Uri) {
		this.dlc = await getDLC()
		console.log("using DLC = " + this.dlc)
		this.promsgs = new ABLPromsgs(this.dlc, storageUri)
	}

	setStatus(status: string) {
		this.status = status
		logToChannel("STATUS: " + status)
	}

	async setTestData(testData: WeakMap<TestItem, ABLUnitTestData>) {
		this.testData = testData
	}

	async start () {
		await this.cfg.setTempDirUri(ablunitConfig.tempDirUri)
		await this.cfg.readPropathFromJson().then((propath) => {
			this.propath = propath
			this.debugLines = new ABLDebugLines(this.propath)
		})

		const prom: Promise<void>[] = [Promise.resolve()]
		prom[0] = this.cfg.createProfileOptions(ablunitConfig.profilerOptions)
		prom[1] = this.cfg.createProgressIni(this.propath!.toString())
		prom[2] = this.cfg.createAblunitJson(ablunitConfig.configJson)

		return Promise.all(prom).then(() => {
			console.log("done creating config files for run")
		}, (err) => {
			console.error("ABLResults.start() did not complete promises")
		})
	}

	resetTests() {
		ablunitConfig.configJson.tests = undefined
	}

	async addTest (testName: string) {

		console.log("addTest testName=" + testName)


		let testCase = undefined
		if (testName.indexOf("#") > -1) {
			testCase = testName.split("#")[1]
			testName = testName.split("#")[0]
		}

		const testUri = Uri.joinPath(ablunitConfig.workspaceUri, testName.toString())
		let testRel: string = workspace.asRelativePath(testName)

		const p = await this.propath!.search(testUri)
		if (p) {
			testRel = p.propathRelativeFile
		}
		testRel = testRel.replace(/\\/g, '/')

		let testObj: { test: string; cases?: string[] }
		if (!testCase) {
			testObj = { test: testRel }
		} else {
			testObj = { test: testRel, cases: [ testCase ] }
		}

		if (!ablunitConfig.configJson.tests) {
			ablunitConfig.configJson.tests = [testObj]
		} else if (testCase) {
			const testObj = ablunitConfig.configJson.tests.find((t: any) => t.test === testRel)
			if (testObj) {
				testObj.cases?.push(testCase)
			} else {
				ablunitConfig.configJson.tests = testObj
			}
		} else {
			ablunitConfig.configJson.tests.push(testObj)
		}
	}

	async createAblunitJson() {
		return this.cfg.createAblunitJson(ablunitConfig.configJson)
	}

	async deleteResultsXml() {
		workspace.fs.stat(ablunitConfig.config_output_jsonUri).then((stat) => {
			if (stat.type === FileType.File) {
				console.log("delete " + ablunitConfig.config_output_jsonUri.fsPath)
				workspace.fs.delete(ablunitConfig.config_output_jsonUri)
			}
		}, (err) => {
			// do nothing, can't delete a file that doesn't exist
		})
		return workspace.fs.stat(ablunitConfig.config_output_resultsUri).then((stat) => {
			if (stat.type === FileType.File) {
				console.log("delete " + ablunitConfig.config_output_resultsUri.fsPath)
				return workspace.fs.delete(ablunitConfig.config_output_resultsUri)
			}
		}, (err) => {
			// do nothing, can't delete a file that doesn't exist
		})
	}

	async run(options: TestRun) {
		return ablunitRun(ablunitConfig, options, this).then(() => {
			if(!this.ablResults!.resultsJson) {
				throw new Error("no results available")
			}
		}, (err) => {
			console.log("-- [ABLResults run caught exception]")
			throw new Error("ablunitRun error: " + err)
		})
	}

	async parseOutput(options: TestRun) {
		this.setStatus("parsing results")
		options.appendOutput("parsing results\r\n")

		this.endTime = new Date()

		this.ablResults = new ABLResultsParser(this.propath!, this.debugLines!)
		await this.ablResults.parseResults(ablunitConfig.configJson, ablunitConfig.config_output_resultsUri, ablunitConfig.config_output_jsonUri).then(() => {
			if(!this.ablResults!.resultsJson) {
				throw (new Error("no results data available..."))
			}
		}, (err) => {
			console.error("[parseResultsFile] " + err)
		})

		if (ablunitConfig.profilerOptions.enabled) {
			this.setStatus("parsing profiler data")
			options.appendOutput("parsing profiler data\r\n")
			await this.parseProfile().then(() => {
				return true
			}, (err) => {
				throw new Error("parseProfile error: " + err)
			})
		}

		this.setStatus("parsing output complete")
		options.appendOutput("parsing output complete\r\n")
	}

	async assignTestResults (item: TestItem, options: TestRun) {
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
		const s = this.ablResults.resultsJson[0].testsuite.find((s: TestSuite) => s.classname === suiteName || s.name === suiteName)
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
			await this.parseChildSuites(item, s.testsuite, options, suiteName)
		} else {
			return this.parseFinalSuite(item, s, options)
		}
	}

	async parseChildSuites (item: TestItem, s: TestSuite[], options: TestRun, suiteName: string) {
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

	private async parseFinalSuite (item: TestItem, s: TestSuite, options: TestRun) {
		if (s.tests > 0) {
			if (s.errors === 0 && s.failures === 0) {
				options.passed(item, s.time)
			} else if (s.tests === s.skipped) {
				options.skipped(item)
			} else if (s.failures > 0 || s.errors > 0) {
				//// This should be populated automatically by the child messages filtering up
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
		let suiteName = item.id
		if (suiteName.indexOf("#") > -1) {
			suiteName = item.id.split("#")[0]
		}

		if(suiteName) {
			const propathRelativePath = this.propath!.search(suiteName)!
			suiteName = await propathRelativePath.then((res) => {
				if (res?.propathRelativeFile) {
					return res?.propathRelativeFile
				}
				return suiteName
			})
		}
		suiteName = suiteName.replace(/\\/g, '/')
		return suiteName
	}

	private async setAllChildResults(children: TestItemCollection, testcases: TestCase[], options: TestRun) {
		const promArr: Promise<void>[] = [Promise.resolve()]
		children.forEach(child => {
			const tc = testcases.find((t: TestCase) => t.name === child.label)
			if (!tc) {
				logToChannel("could not find result for test case " + child.label)
				options.errored(child, new TestMessage("could not find result for test case"))
				return
			}
			promArr.push(this.setChildResults(child, options, tc))
		})

		return Promise.all(promArr)
	}

	private async setChildResults(item: TestItem, options: TestRun, tc: TestCase) {
		switch (tc.status) {
			case "Success":
				options.passed(item, tc.time)
				return
			case "Failure":
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
			case "Error":
				if (tc.failure) {
					return this.getFailureMarkdownMessage(item, options, tc.failure).then((msg) => {
						const tm = new TestMessage(msg)
						options.failed(item, [ tm ], tc.time)
					})
				}
				throw new Error("unexpected error for " + tc.name)
			case "Skpped":
				options.skipped(item)
				return
			default:
				throw new Error("unexpected test status " + tc.status + " for " + tc.name)
		}
	}

	private async getFailureMarkdownMessage(item: TestItem, options: TestRun, failure: TCFailure): Promise<MarkdownString> {
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

	private getDiffMessage (failure: TCFailure) {
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

	async parseProfile() {
		const profParser = new ABLProfile()
		return profParser.parseData(ablunitConfig.profilerOptions, this.debugLines!).then(() => {
			this.profileJson = profParser.profJSON
			return this.assignProfileResults().then(() => {
				console.log("assignProfileResults complete")
			}, (err) => {
				throw new Error("assignProfileResults error: " + err)
			})
		})
	}

	async assignProfileResults() {
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

	async setCoverage(module: Module) {
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

		for (let idx=0; idx < module.lines.length; idx++) { //NOSONAR
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

			if (fc?.uri.fsPath != dbg.incUri.fsPath) {
				//get existing FileCoverage object
				fc = this.testCoverage.get(dbg.incUri.fsPath)
				if (!fc) {
					//create a new FileCoverage object if one didn't already exist
					fc = new FileCoverage(dbg.incUri, new CoveredCount(0, 0))
					fc.detailedCoverage = []
					this.coverage.push(fc)
					this.testCoverage.set(fc.uri.fsPath, fc)
				}
			}

			fc.detailedCoverage!.push(new StatementCoverage(line.ExecCount ?? 0,
				new Range(new Position(dbg.incLine - 1, 0), new Position(dbg.incLine, 0))))
		}
	}
}

interface IRuntime {
	name: string,
	path: string,
	default?: boolean
}

async function getDLC() {
	let defaultDLC: string | undefined = undefined
	const oeversion = await getOEVersion()
	const runtimes: IRuntime[] = workspace.getConfiguration("abl.configuration").get("runtimes",[])

	for (const runtime of runtimes) {
		if (runtime.name === oeversion) {
			return runtime.path
		}
		if (runtime.default) {
			defaultDLC = runtime.path
		}
	}
	if (defaultDLC) {
		return defaultDLC
	}
	if(!process.env.DLC) {
		throw new Error("unable to determine DLC")
	}

	return process.env.DLC
}
