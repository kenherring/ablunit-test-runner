import { ABLUnitConfig } from "./ABLUnitConfig"
import { CoveredCount, FileCoverage, MarkdownString, Position, Range, StatementCoverage, TestItem, TestMessage, TestRun, Uri, workspace } from "vscode"
import { ABLResultsParser, TCFailure, TestCase, TestSuite, TestSuites } from "./parse/ABLResultsParser"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { parseABLCallStack } from "./ABLHelper"
import { PropathParser } from "./ABLPropath"
import { ABLProfile } from "./ABLProfileParser"
import { ABLProfileJSON, LineSummary, Module } from "./ABLProfileSections"
import { getSourceLine, importDebugFile } from "./ABLDebugLines"
import { getPromsg } from "./ABLpromsgs"

interface RunConfig {
	workspaceDir?: Uri
	propath?: string
	progressIni?: Uri
	listingDir?: Uri
	profileOptions?: Uri
	profileOutput?: Uri
	profileOutputJson?: Uri
	ablunitJson?: Uri
	ablunitOptions?: Options
	cmd?: string[]
	tempDir?: Uri
	resultsUri?: Uri
}

export class ABLResults {
	public runConfig: RunConfig = {}
	testData!: WeakMap<TestItem, ABLUnitTestData>
	cfg: ABLUnitConfig
	profJson: [] = []
	resultsJsonUri: [] = []
	coverageJson: [] = []
	startTime: Date
	endTime!: Date
	duration = () => { return (Number(this.endTime) - Number(this.startTime)) }
	public propath: PropathParser
	testResultsJson?: TestSuites
	profileJson?: ABLProfileJSON
	testCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()


	constructor(cfg: ABLUnitConfig) {
		this.cfg = cfg
		this.startTime = new Date()
		this.runConfig.workspaceDir = cfg.workspaceUri()
		this.runConfig.resultsUri = cfg.resultsUri()
		this.propath = new PropathParser(cfg)
	}

	async setTestData(testData: WeakMap<TestItem, ABLUnitTestData>) {
		this.testData = testData
	}

	async setPropath(propath: string) {
		this.runConfig.propath = propath
		this.propath.setPropath(propath)
	}

	async parseOutput(item: TestItem, options: TestRun) {
		console.log("parseOutput - start profile")
		await this.parseProfile().then(() => {
			console.log("this.parseProfile() complete")
			return true
		}, (err) => { console.error("parseProfile error: " + err) })

		console.log("parseOutput - start results")
		await this.parseResultsFile(item, options).then(() => {
			console.log("this.parseResultsFile complete")
			return true
		}, (err) => { console.error("parseResultsFile error: " + err) })

		console.log("parseOutput - done")

		// const prom: Promise<void | void[]>[] = [Promise.resolve()]
		// prom[0] = this.parseResultsFile(item, options)
		// prom[1] = this.parseProfile()
		// return Promise.all(prom).then(() => {
		// 	console.log("result and profile parse complete")
		// }, (err) => {
		// 	console.error("error processing results/profile output: " + err)
		// })
	}

	async parseResultsFile(item: TestItem, options: TestRun) {
		this.endTime = new Date()
		const ablResults = new ABLResultsParser()
		return ablResults.importResults(this.runConfig.resultsUri!).then(() => {
			this.testResultsJson = ablResults.resultsJson
			return this.assignTestResults(item, options)
		})
	}

	async assignTestResults (item: TestItem, options: TestRun) {
		const res = this.testResultsJson
		if(!res) {
			throw (new Error("no results data available..."))
		}

		if (!res!.testsuite) {
			console.log("malformed results - could not find 'testsuite' node")
			options.errored(item, new TestMessage("malformed results - could not find 'testsuite' node"), this.duration())
			return
		}

		//if class??
		let suiteName = item.id
		if (suiteName.indexOf("#") > -1) {
			suiteName = item.id.split("#")[0]
		}
		const s = res.testsuite.find((s: TestSuite) => s.classname === suiteName)
		if (!s) {
			console.log("could not find test suite in results")
			options.errored(item, new TestMessage("could not find test suite in results"), this.duration())
			return
		}

		const td = this.testData!.get(item)
		if (td && (td instanceof ABLTestProcedure || td instanceof ABLTestMethod)) {
			// Test Procedure/Method type
			if (! s.testcases) { return }
			const tc = s.testcases.find(tc => tc.name === item.label)
			if (! tc) { return }
			return this.setChildResults(item, options, tc)
		}

		// TestFile type
		if (s.tests > 0) {
			if (s.errors == 0 && s.failures == 0) {
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
			options.errored(item, new TestMessage("No test cases discovered or run - check the configuration for accuracy"), this.duration())
			return
		}

		const promArr: Promise<void>[] = [Promise.resolve()]
		item.children.forEach(child => {
			const tc = s.testcases?.find(t => t.name === child.label)
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
					return this.getFailureMarkdownMessage(tc.failure).then((msg) => {
						options.failed(item, [ new TestMessage(msg) ], tc.time)
					})
				}
				throw (new Error("unexpected failure"))
			case "Error":
				if (tc.error) {
					return this.getFailureMarkdownMessage(tc.error).then((msg) => {
						options.failed(item, [ new TestMessage(msg) ], tc.time)
					})
				}
				throw (new Error("unexpected error"))
			case "Skpped":
				options.skipped(item)
				return
			default:
				throw (new Error("unexpected test status: " + tc.status))
		}
	}

	async parseProfile() {
		const profParser = new ABLProfile()
		return profParser.parseData(this.runConfig.profileOutput!, this.propath).then(() => {
			console.log("parseProfile parseData complete! did propath flow? " + this.propath.propath)
			profParser.writeJsonToFile(this.runConfig.profileOutputJson!)
			this.profileJson = profParser.profJSON
			return this.assignProfileResults().then(() => {
				console.log("assignProfileResults complete")
			}, (err) => {
				console.error("assignProfileResults error: " + err)
			})
		})
	}

	async assignProfileResults() {
		if (!this.profileJson) {
			throw (new Error("no profile data available..."))
		}

		this.profileJson.modules.forEach((module: Module) => {
			if (!module.SourceName || module.SourceName.startsWith("OpenEdge") || module.SourceName == "ABLUnitCore.p") {
				return
			}
			this.setCoverage(module)
		})
	}

	async setCoverage(module: Module) {
		if (!module.SourceName) { return }
		const moduleUri = await this.propath.searchPropath(module.SourceName)
		if (!moduleUri) {
			console.error("could not find moduleUri for " + module.SourceName)
			return
		}
		console.log("setCoverage-1 module.SourceName=" + module.SourceName)

		let fc: FileCoverage | undefined = undefined
		try {
			console.log("setCoverage-2")
			module.lines.forEach((line: LineSummary) => {
				console.log("setCoverage-3 " + line.LineNo)
				if (line.LineNo <= 0) {
					//TODO
					//  * -2 is a special case - need to handgle this better
					//  *  0 is a special case - method header
					return
				}
				console.log("setCoverage-4 " + module.SourceName + " " + moduleUri)
				const dbg = getSourceLine(moduleUri, line.LineNo)
				if (!dbg) {
					console.error("cannot find dbg for " + moduleUri.fsPath)
					return
				}
				console.log("setCoverage-5")

				if (!fc || fc!.uri.fsPath != dbg.incUri.fsPath) {
					//get existing FileCoverage object
					fc = this.testCoverage.get(dbg.incUri.fsPath)
					if (!fc) {
						console.log("setCoverage-7")
						//create a new FileCoverage object if one didn't already exist
						fc = new FileCoverage(dbg.incUri, new CoveredCount(0, 0))
						fc.detailedCoverage = []
						this.testCoverage.set(fc.uri.fsPath, fc)
					}
				}

				console.log("setCoverage-8")
				if (!fc) { throw (new Error("cannot find or create FileCoverage object")) }
				console.log("setCoverage-9")
				fc.detailedCoverage!.push(new StatementCoverage(line.ExecCount ?? 0,
					new Range(new Position(dbg.incLine - 1, 0), new Position(dbg.incLine, 0))))
					console.log("setCoverage-10")
				});
				console.log("setCoverage-11")
			} catch {
				//Do nothing, likely can't find debug listing
			}
			console.log("setCoverage-12")
		// TODO - turn this into TestCoverage class objects
		//      - will be useful when the proposed API is finalized
	}

	debugMap: Map<string, Uri> = new Map<string, Uri>()

	async getDebugUri (debugFile: string) {
		// console.log("search propath for " + debugFile)

		let propathRelativeFile = debugFile
		if (!debugFile.endsWith(".p")) {
			propathRelativeFile = debugFile.replace(/\./g,'/') + ".cls"
		}
		let debugUri = await this.propath.searchPropath(propathRelativeFile)

		console.log("debugUri=" + debugUri)

		if (!debugUri) {
			debugUri = Uri.joinPath(this.runConfig.workspaceDir!,debugFile)
		}
		// Probably don't want both, but keeping for now until we're more consistent
		this.debugMap.set(propathRelativeFile, debugUri)
		this.debugMap.set(debugFile, debugUri)
		return importDebugFile(propathRelativeFile, debugUri)
		// return await importDebugFile(propathRelativeFile, debugUri)
	}

	async getFailureMarkdownMessage(failure: TCFailure): Promise<MarkdownString> {
		const stack = parseABLCallStack(failure.callstack)

		// start getting the debug files where needed
		const promArr: Promise<void>[] = [Promise.resolve()]
		const paths: string[] = []

		stack.lines.forEach((line) => {
			if(line.debugFile.startsWith("OpenEdge.") || line.debugFile === "ABLUnitCore.p") { return }
			if (paths.indexOf(line.debugFile) == -1) {
				paths.push(line.debugFile)
				promArr.push(this.getDebugUri(line.debugFile))
			}
		})

		const promsgMatch = RegExp(/\((\d+)\)$/).exec(failure.message)
		let promsgNum = ""
		if (promsgMatch)
		promsgNum = promsgMatch[1]
		const promsg = getPromsg(Number(promsgNum))

		let stackString = failure.message
		if(promsg) {
			let count = 0
			promsg.msgtext.forEach((text: string) => {
				if (count === 0) {
					count++
				} else {
					stackString += "\n\n" + text.replace(/\\n/g,"\n\n")
				}
			})
		}

		stackString += "\n\n" + "**ABL Call Stack**\n\n"
		let stackCount = 0

		return await Promise.all(promArr).then(() => {
			console.log("ready to build stack message")
			// all the debug lists have been resolved, now build the stack message
			stack.lines.forEach((line) => {
				stackString += "<code>"
				if (stackCount == 0) {
					stackString += "--> "
				} else {
					stackString += "&nbsp;&nbsp;&nbsp; "
				}
				stackCount = stackCount + 1
				if (line.method) {
					stackString += line.method + " "
				}

				stackString += line.debugFile + " at line " + line.debugLine.line
				const dbgUri = this.debugMap.get(line.debugFile)
				if(dbgUri) {
					const relativePath =  workspace.asRelativePath(dbgUri)
					if (!relativePath.startsWith("OpenEdge.") && relativePath != "ABLUnitCore.p") {
						const dbg = getSourceLine(dbgUri,line.debugLine.line)
						console.log("dbgUri=" + dbgUri + " line.debugLine.line=" + line.debugLine.line)
						if(dbg) {
							const incRelativePath = workspace.asRelativePath(dbg.incUri)
							stackString += " (" + "[" + incRelativePath + ":" + dbg.incLine + "]" +
												"(command:_ablunit.openStackTrace?" + encodeURIComponent(JSON.stringify(dbg.incUri + "&" + dbg.incLine)) + ")" + ")"
						}
					}
				}
				stackString += "</code><br>\n"
			})
			const md = new MarkdownString(stackString);
			md.isTrusted = true;
			md.supportHtml = true;
			return md;
		}, (err) => {

			stack.lines.forEach((line) => {
				stackString += "<code>"
				if (stackCount == 0) {
					stackString += "--> "
				} else {
					stackString += "&nbsp;&nbsp;&nbsp; "
				}
				stackCount = stackCount + 1
				if (line.method) {
					stackString += line.method + " "
				}

				stackString += line.debugFile + " at line " + line.debugLine.line
				stackString += "</code><br>\n"
			})
			const md = new MarkdownString(stackString)
			md.supportHtml = true
			return md
		})
	}
}