import { FileCoverage, MarkdownString, TestItem, TestMessage, TestRun, Uri, workspace, Location, Range, Position } from "vscode"
import { ABLUnitConfig } from "./ABLUnitConfigWriter"
import { ABLResultsParser, TCFailure, TestCase, TestSuite, TestSuites } from "./ABLResultsParser"
import { ABLTestMethod, ABLTestProcedure, ABLUnitTestData } from "./testTree"
import { parseCallstack } from "./parse/ParseCallStack"
import { ABLProfile } from "./ABLProfileParser"
import { ABLProfileJSON, LineSummary, Module } from "./ABLProfileSections"
import { ABLDebugLines } from "./ABLDebugLines"
import { ABLPromsgs, getPromsg } from "./ABLPromsgs"
import { PropathParser } from "./ABLPropath"
import { outputChannel } from "./ABLUnitCommon"

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
	ablunitJson?: Uri

	resultsUri?: Uri
	profileOutput?: Uri
	profileOutputJson?: Uri

	cmd?: string[]
}

export class ABLResults {

	private cfg: ABLUnitConfig

	public status: string = "none"
	public runConfig: RunConfig
	public testCoverage: Map<string, FileCoverage> = new Map<string, FileCoverage>()

	startTime: Date
	endTime!: Date
	duration = () => { return (Number(this.endTime) - Number(this.startTime)) }

	propath: PropathParser | undefined
	debugLines?: ABLDebugLines

	promsgs: ABLPromsgs | undefined
	testResultsJson?: TestSuites
	profileJson?: ABLProfileJSON
	coverageJson: [] = []

	testData!: WeakMap<TestItem, ABLUnitTestData>
	ablunitOptions: AblunitOptions = {} as AblunitOptions

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

	async setTestData(testData: WeakMap<TestItem, ABLUnitTestData>) {
		this.testData = testData
	}

	async start () {
		//TODO - do all, then wait

		await this.cfg.getTempDirUri(this.runConfig.tempDirUri).then((uri) => {
			this.runConfig.tempDirUri = uri
		}, (err) => {
			//Do nothing - we'll use the default storageUri
			outputChannel.appendLine("using tempDir='" + this.runConfig.tempDirUri.fsPath + "'")
		})
		await this.cfg.createTempDirUri(this.runConfig.tempDirUri).then((uri) => {
			console.log("tempDir='" + uri.fsPath + "'")
		}, (err) => {
			throw err
		})

		this.promsgs = new ABLPromsgs(this.runConfig.tempDirUri)

		await this.cfg.readPropathFromJson().then((propath) => {
			this.propath = propath
			this.debugLines = new ABLDebugLines(this.propath)
		}, (err) => {
			console.error("readPropathFromJson error: " + err)
			throw (err)
		})
		this.debugLines = new ABLDebugLines(this.propath!)
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
			console.log("done creating config files for run")
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

	async parseOutput(item: TestItem, options: TestRun) {
		this.endTime = new Date()
		this.status = "parsing"
		// await this.parseProfile().then(() => {
		// 	return true
		// }, (err) => { console.error("parseProfile error: " + err) })

		console.log("parseResultsFile")

		const ablResults = new ABLResultsParser(this.propath!, this.debugLines!)
		await ablResults.importResults(this.runConfig.resultsUri!).then(() => {
			if(!ablResults.resultsJson) {
				throw (new Error("no results data available..."))
			}
			return this.assignTestResults(ablResults.resultsJson, item, options)
		}, (err) => {
			console.error("parseResultsFile error: " + err)
		})
		this.status = "complete"
	}

	async assignTestResults (resultsJson: TestSuites, item: TestItem, options: TestRun) {
		this.testResultsJson = resultsJson
		const res = resultsJson
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

		let s = res.testsuite.find((s: TestSuite) => s.classname === suiteName)
		if (!s) {
			s = res.testsuite.find((s: TestSuite) => s.name === suiteName)
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
					return this.getFailureMarkdownMessage(item, options, tc.failure).then((msg) => {
						const tm = new TestMessage(msg)
						tm.location = tc.failure!.callstackFirstLocation
						console.log("position: " + JSON.stringify(tm.location))
						options.failed(item, [ tm ], tc.time)
					})
				}
				throw (new Error("unexpected failure"))
			case "Error":
				if (tc.error) {
					return this.getFailureMarkdownMessage(item, options, tc.error).then((msg) => {
						const tm = new TestMessage(msg)
						tm.location = tc.failure!.callstackFirstLocation
						options.failed(item, [ tm ], tc.time)
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
		// return profParser.parseData(this.runConfig.profileOutput!, this.propath!).then(() => {
		return profParser.parseData(this.runConfig.profileOutput!).then(() => {
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
			console.error("could not find moduleUri for " + module.SourceName)
			return
		}

		//can we import this sooner?
		// await this.importDebugFile(module.SourceName).then()

		// let fc: FileCoverage = new FileCoverage(module.SourceUri, new CoveredCount(0, 0)) : new FileCoverage(moduleUri, new CoveredCount(0, 0))
		let fc: FileCoverage | undefined

		module.lines.forEach((line: LineSummary) => {
			if (line.LineNo <= 0) {
				//  * -2 is a special case - need to handgle this better
				//  *  0 is a special case - method header
				return
			}

			// const dbg = this.debugLines.getSourceLine(moduleUri, moduleUri, line.LineNo)
			// if (!dbg) {
			// 	console.error("cannot find dbg for " + moduleUri.fsPath)
			// 	return
			// }

			// if (fc?.uri.fsPath != dbg.incUri.fsPath) {
			// 	//get existing FileCoverage object
			// 	fc = this.testCoverage.get(dbg.incUri.fsPath)
			// 	if (!fc) {
			// 		//create a new FileCoverage object if one didn't already exist
			// 		fc = new FileCoverage(dbg.incUri, new CoveredCount(0, 0))
			// 		fc.detailedCoverage = []
			// 		this.testCoverage.set(fc.uri.fsPath, fc)
			// 	}
			// }

			// if (!fc) { throw (new Error("cannot find or create FileCoverage object")) }

			// fc.detailedCoverage!.push(new StatementCoverage(line.ExecCount ?? 0,
			// 	new Range(new Position(dbg.incLine - 1, 0), new Position(dbg.incLine, 0))))
		})

		// TODO - turn this into TestCoverage class objects
		//      - will be useful when the proposed API is finalized
	}

	async getFailureMarkdownMessage(item: TestItem, options: TestRun, failure: TCFailure): Promise<MarkdownString> {
		const stack = await parseCallstack(this.debugLines!, failure.callstackRaw)
		//TODO - get promsg

		const md = new MarkdownString(failure.message + "\n\n")

		if (stack.markdownText) {
			md.appendMarkdown(stack.markdownText)

			console.log("append output?")

			for(const stackItem of stack.items) {
				console.log("stackItem")
				if(stackItem.loc) {
					console.log("appendLog " + JSON.stringify(stackItem.loc))
					options.appendOutput(item.label + " failed", stackItem.loc)
				}
			}
		} else {
			md.appendMarkdown(failure.message + "\n\n**ABL Call Stack**\n\n<code>\n" + failure.callstackRaw.replace(/\r/g,'\n') + "\n</code>")
		}
		md.isTrusted = true
		md.supportHtml = true
		return md
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
