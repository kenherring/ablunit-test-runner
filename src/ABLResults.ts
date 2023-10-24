import { MarkdownString, Position, Range, TestItem, TestMessage, TestRun, Uri, workspace } from "vscode"
import { ABLUnitConfig, ablunitConfig } from "./ABLUnitConfigWriter"
import { ABLResultsParser, TCFailure, TestCase, TestSuite, TestSuites } from "./ABLResultsParser"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { parseCallstack } from "./parse/ParseCallStack"
import { ABLProfile } from "./ABLProfileParser"
import { ABLProfileJSON, Module } from "./ABLProfileSections"
import { ABLDebugLines } from "./ABLDebugLines"
import { ABLPromsgs, getPromsgText } from "./ABLPromsgs"
import { PropathParser } from "./ABLPropath"
import { outputChannel } from "./ABLUnitCommon"
import { FileCoverage, CoveredCount, StatementCoverage } from "./TestCoverage"


export class ABLResults {
	public status: string = "none"
	private cfg: ABLUnitConfig
	startTime: Date
	endTime!: Date
	duration = () => { return (Number(this.endTime) - Number(this.startTime)) }

	testData!: WeakMap<TestItem, ABLUnitTestData>
	propath?: PropathParser
	debugLines?: ABLDebugLines
	promsgs?: ABLPromsgs
	results?: TestSuites
	profileJson?: ABLProfileJSON
	coverageJson: [] = []
	coverage: FileCoverage[] = []
	public testCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()


	constructor(storageUri: Uri) {
		if (!workspace.workspaceFolders) {
			throw new Error("no workspace folder is open")
		}
		const workspaceDir = workspace.workspaceFolders[0].uri
		this.cfg = new ABLUnitConfig(workspaceDir)
		this.startTime = new Date()
		ablunitConfig.workspaceUri = workspaceDir
		ablunitConfig.tempDirUri = storageUri
		this.setStatus("constructed")
	}

	setStatus(status: string) {
		this.status = status
		outputChannel.appendLine("STATUS: " + status)
		console.log("STATUS: " + status)
	}

	async setTestData(testData: WeakMap<TestItem, ABLUnitTestData>) {
		this.testData = testData
	}

	async start () {

		await this.cfg.setTempDirUri(ablunitConfig.tempDirUri)
		this.promsgs = new ABLPromsgs(ablunitConfig.tempDirUri)

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
		})
	}

	async parseOutput(item: TestItem, options: TestRun) {
		this.setStatus("parsing results")
		this.endTime = new Date()

		const ablResults = new ABLResultsParser(this.propath!, this.debugLines!)
		await ablResults.parseResults(ablunitConfig.configJson).then(() => {
			if(!ablResults.resultsJson) {
				throw (new Error("no results data available..."))
			}
			return this.assignTestResults(ablResults.resultsJson, item, options)
		}, (err) => {
			console.error("[parseResultsFile] " + err)
		})

		if (ablunitConfig.profilerOptions.enabled) {
			this.setStatus("parsing profiler data")
			await this.parseProfile().then(() => {
				return true
			}, (err) => {
				console.error("parseProfile error: " + err)
			})
		}
	}

	async assignTestResults (resultsJson: TestSuites[], item: TestItem, options: TestRun) {
		if(resultsJson.length > 1) {
			options.errored(item, new TestMessage("multiple results files found - this is not supported"), this.duration())
			return
		}
		this.results = resultsJson[0]
		if (!this.results.testsuite) {
			options.errored(item, new TestMessage("no tests results available, check the configuration for accuracy"), this.duration())
			return
		}

		let suiteName = item.id
		if (suiteName.indexOf("#") > -1) {
			suiteName = item.id.split("#")[0]
		}

		let s = this.results.testsuite.find((s: TestSuite) => s.classname === suiteName || s.name === suiteName)
		if (!s) {
			suiteName = item.uri!.fsPath.replace(/\\/g, '/')
			s = this.results.testsuite.find((s: TestSuite) => s.name === suiteName)
		}
		if (!s) {
			options.errored(item, new TestMessage("could not find test suite for '" + suiteName + " in results"), this.duration())
			return
		}

		const td = this.testData.get(item)
		if (td && (td instanceof ABLTestProcedure || td instanceof ABLTestMethod)) {
			// Test Procedure/Method type
			if (! s.testcases) { return }
			const tc = s.testcases.find((tc: TestCase) => tc.name === item.label)
			if (! tc) { return }
			return this.setChildResults(item, options, tc)
		}

		// TestFile type
		if (s.tests > 0) {
			if (s.errors === 0 && s.failures === 0) {
				options.passed(item, s.time)
			} else if (s.tests === s.skipped) {
				options.skipped(item)
			} else if (s.failures > 0 || s.errors > 0) {
				//// This should be populated automatically by the child messages filtering up
				// options.failed(item, new vscode.TestMessage("one or more tests failed"), s.time)
			} else {
				options.errored(item, new TestMessage("unknown error - test results are all zero"), s.time)
			}
		}

		if (!s.testcases) {
			options.errored(item, new TestMessage("no test cases discovered or run - check the configuration for accuracy"), this.duration())
			return
		}

		const promArr: Promise<void>[] = [Promise.resolve()]
		item.children.forEach(child => {
			const tc = s!.testcases?.find((t: TestCase) => t.name === child.label)
			if (!tc) {
				options.errored(child, new TestMessage("could not find result for test case"))
				return
			}
			promArr.push(this.setChildResults(child, options, tc))
		})

		return Promise.all(promArr)
	}

	async setChildResults(item: TestItem, options: TestRun, tc: TestCase) {
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

	async getFailureMarkdownMessage(item: TestItem, options: TestRun, failure: TCFailure): Promise<MarkdownString> {
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

	getDiffMessage (failure: TCFailure) {
		if (!failure.diff) {
			return undefined
		}
		const tm = TestMessage.diff("Assert failed!", failure.diff.expectedOutput, failure.diff.actualOutput)
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
