import { CoveredCount, FileCoverage, MarkdownString, Position, Range, StatementCoverage, TestItem, TestMessage, TestRun, Uri, workspace } from "vscode"
import { ABLUnitConfig } from "./ABLUnitConfigWriter"
import { ABLResultsParser, TCFailure, TestCase, TestSuite, TestSuites } from "./ABLResultsParser"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { parseABLCallStack } from "./ABLHelper"
import { ABLProfile } from "./ABLProfileParser"
import { ABLProfileJSON, LineSummary, Module } from "./ABLProfileSections"
import { ABLDebugLines } from "./ABLDebugLines"
import { ABLPromsgs, getPromsg } from "./ABLpromsgs"
import { PropathParser } from "./ABLPropath"

interface AblunitOptions {
	output: {
		location: string
		format: "xml"
	},
	quitOnEnd: boolean
	writeLog: boolean
	showErrorMessage: boolean
	throwError: boolean
	tests?: [
		{
			test: string,
			cases?: [
				string
			]
		} |
		{
			folder: string
		}
	]
}

interface RunConfig {
	workspaceDir: Uri
	tempDirUri: Uri
	progressIni?: Uri
	listingDir?: Uri
	profileOptions?: Uri
	profileOutput?: Uri
	profileOutputJson?: Uri
	ablunitJson?: Uri
	cmd?: string[]
	resultsUri?: Uri
}

export class ABLResults {
	public status: string = "none"
	public runConfig: RunConfig
	testData!: WeakMap<TestItem, ABLUnitTestData>
	private cfg: ABLUnitConfig
	profJson: [] = []
	resultsJsonUri: [] = []
	coverageJson: [] = []
	startTime: Date
	endTime!: Date
	duration = () => { return (Number(this.endTime) - Number(this.startTime)) }
	testResultsJson?: TestSuites
	profileJson?: ABLProfileJSON
	debugLines = new ABLDebugLines()
	public testCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()
	debugMap: Map<string, Uri> = new Map<string, Uri>()
	sourceMap: Map<string, Uri> = new Map<string, Uri>()
	ablunitOptions: AblunitOptions = {} as AblunitOptions
	promsgs: ABLPromsgs | undefined
	propath: PropathParser | undefined

	constructor(storageUri: Uri) {
		if (!workspace.workspaceFolders) {
			throw (new Error("no workspace folder is open"))
		}

		this.startTime = new Date()
		this.runConfig = {
			workspaceDir: workspace.workspaceFolders[0].uri,
			tempDirUri: storageUri
		}
		this.cfg = new ABLUnitConfig(this.runConfig.workspaceDir)
		this.status = "constructed"
	}

	async start () {
		//TODO - do all, then wait

		await this.cfg.getTempDirUri().then((uri) => {
			this.runConfig.tempDirUri = uri
		})

		this.promsgs = new ABLPromsgs(this.runConfig.tempDirUri)

		this.propath = await this.cfg.readPropathFromJson().then()
		this.runConfig.ablunitJson = Uri.joinPath(this.runConfig.tempDirUri, 'ablunit.json')
		this.runConfig.listingDir = Uri.joinPath(this.runConfig.tempDirUri, 'listings')
		this.runConfig.profileOutput = this.cfg.getProfileOutput(this.runConfig.tempDirUri)
		this.runConfig.profileOutputJson = Uri.file(this.runConfig.profileOutput.fsPath.replace(/\.out$/, ".json"))
		this.runConfig.resultsUri = this.cfg.resultsUri(this.runConfig.tempDirUri)
		this.runConfig.profileOptions = Uri.joinPath(this.runConfig.tempDirUri, 'profile.options')

		this.runConfig.progressIni = await this.cfg.getProgressIni(this.runConfig.tempDirUri)

		const prom: Promise<void>[] = [Promise.resolve()]
		prom[0] = this.cfg.createProfileOptions(this.runConfig.profileOptions, this.runConfig.profileOutput, this.runConfig.listingDir)
		prom[1] = this.cfg.createProgressIni(this.runConfig.progressIni, this.propath!.toString())
		prom[2] =  this.cfg.createListingDir(this.runConfig.listingDir)

		await Promise.all(prom).then(() => {
			// console.log("done creating files")
		}, (err) => {
			throw err
		})
	}

	async createAblunitJson (itemPath: string) {
		this.ablunitOptions = {
			output: {
				location: this.runConfig.resultsUri!.fsPath,
				format: "xml",
			},
			quitOnEnd: true,
			writeLog: true,
			showErrorMessage: true,
			throwError: true,
			tests: [
				{ test: itemPath }
			]
		}
	}

	async setTestData(testData: WeakMap<TestItem, ABLUnitTestData>) {
		this.testData = testData
	}

	async parseOutput(item: TestItem, options: TestRun) {
		this.status = "parsing"
		await this.parseProfile().then(() => {
			return true
		}, (err) => { console.error("parseProfile error: " + err) })

		await this.parseResultsFile(item, options).then(() => {
			return true
		}, (err) => { console.error("parseResultsFile error: " + err) })

		this.status = "complete"
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
		if (!res.testsuite) {
			if (res.tests === 0) {
				options.errored(item, new TestMessage("no tests run, check the configuration for accuracy"), this.duration())
				return
			}
			options.errored(item, new TestMessage("malformed results - could not find 'testsuite' node"), this.duration())
			return
		}

		let suiteName = item.id
		if (suiteName.indexOf("#") > -1) {
			suiteName = item.id.split("#")[0]
		}

		const s = res.testsuite.find((s: TestSuite) => s.classname === suiteName)
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
			const tc = s.testcases?.find((t: TestCase) => t.name === child.label)
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
		return profParser.parseData(this.runConfig.profileOutput!, this.propath!).then(() => {
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

		const mods: Module[] = this.profileJson.modules
		for (let idx=1; idx < mods.length; idx++) {
			const module = mods[idx]
			if (!module.SourceName || module.SourceName.startsWith("OpenEdge.") || module.SourceName == "ABLUnitCore.p") {
				continue
			}
			await this.setCoverage(module).then()
		}
	}

	async setCoverage(module: Module) {
		const pUri = await this.propath!.searchPropath(module.SourceName)
		const moduleUri = Uri.joinPath(pUri, module.SourceName)
		if (!moduleUri) {
			console.error("could not find moduleUri for " + module.SourceName)
			return
		}

		//can we import this sooner?
		await this.importDebugFile(module.SourceName).then()

		// let fc: FileCoverage = new FileCoverage(module.SourceUri, new CoveredCount(0, 0)) : new FileCoverage(moduleUri, new CoveredCount(0, 0))
		let fc: FileCoverage | undefined

		module.lines.forEach((line: LineSummary) => {
			if (line.LineNo <= 0) {
				//  * -2 is a special case - need to handgle this better
				//  *  0 is a special case - method header
				return
			}

			const dbg = this.debugLines.getSourceLine(moduleUri, line.LineNo)
			if (!dbg) {
				console.error("cannot find dbg for " + moduleUri.fsPath)
				return
			}

			if (fc?.uri.fsPath != dbg.incUri.fsPath) {
				//get existing FileCoverage object
				fc = this.testCoverage.get(dbg.incUri.fsPath)
				if (!fc) {
					//create a new FileCoverage object if one didn't already exist
					fc = new FileCoverage(dbg.incUri, new CoveredCount(0, 0))
					fc.detailedCoverage = []
					this.testCoverage.set(fc.uri.fsPath, fc)
				}
			}

			if (!fc) { throw (new Error("cannot find or create FileCoverage object")) }

			fc.detailedCoverage!.push(new StatementCoverage(line.ExecCount ?? 0,
				new Range(new Position(dbg.incLine - 1, 0), new Position(dbg.incLine, 0))))
		})

		// TODO - turn this into TestCoverage class objects
		//      - will be useful when the proposed API is finalized
	}

	async importDebugFile (debugSourceName: string) {
		let propathRelativeFile: string = debugSourceName
		if (!propathRelativeFile.endsWith(".p") && !propathRelativeFile.endsWith(".cls")) {
			propathRelativeFile = propathRelativeFile.replace(/\./g,'/') + ".cls"
		}

		const propathUri = await this.propath!.searchPropath(debugSourceName)
		const buildDir = await this.propath!.getBuildDir(propathRelativeFile)
		const xrefUri = Uri.joinPath(this.runConfig.workspaceDir,buildDir!,".pct",propathRelativeFile + ".xref")

		// Probably don't want both, but keeping for now until we're more consistent
		const sourceUri = Uri.joinPath(propathUri,propathRelativeFile)
		this.debugMap.set(sourceUri.fsPath, xrefUri)
		this.debugMap.set(debugSourceName, xrefUri)
		this.debugMap.set(debugSourceName.replace(/\.cls$/,''), xrefUri)
		return await this.debugLines.importDebugFile(sourceUri, xrefUri).then(() => {
		}, (err) => {
			console.error("importDebugFile error: " + err)
		})
	}

	async getFailureMarkdownMessage(failure: TCFailure): Promise<MarkdownString> {
		const stack = parseABLCallStack(failure.callstack)

		// start getting the debug files where needed
		const paths: string[] = []

		let stackString = this.getPromsgText(failure.message)
		stackString += "\n\n" + "**ABL Call Stack**\n\n"
		let stackCount = 0

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

			if (!line.debugFile.startsWith("OpenEdge.") && line.debugFile != "ABLUnitCore.p") {
				const sourceUri = this.propath!.searchPropathPostParse(line.debugFile)
				const dbg = this.debugLines.getSourceLine(sourceUri,line.debugLine.line)
				if(dbg) {
					const incRelativePath = workspace.asRelativePath(dbg.incUri)
					stackString += " (" + "[" + incRelativePath + ":" + dbg.incLine + "]" +
										"(command:_ablunit.openStackTraceItem?" + encodeURIComponent(JSON.stringify(dbg.incUri + "&" + dbg.incLine)) + ")" + ")"
				}
			}
			stackString += "</code><br>\n"
		})
		const md = new MarkdownString(stackString);
		md.isTrusted = true;
		md.supportHtml = true;
		return md;
	}

	getPromsgText (text: string) {
		const promsgMatch = RegExp(/\((\d+)\)$/).exec(text)
		if (!promsgMatch) {
			return text
		}

		const promsg = getPromsg(Number(promsgMatch[1]))

		if(!promsg) {
			return text
		}

		let stackString = text
		let count = 0
		promsg.msgtext.forEach((text: string) => {
			if (count === 0) {
				count++
			} else {
				stackString += "\n\n" + text.replace(/\\n/g,"\n\n")
			}
		})
		return stackString
	}
}
