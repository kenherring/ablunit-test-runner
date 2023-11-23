import { Uri, workspace } from "vscode"
import { parseCallstack, ICallStack } from "./CallStackParser"
import { PropathParser } from "../ABLPropath"
import * as xml2js from "xml2js"
import { ABLDebugLines } from "../ABLDebugLines"
import { IABLUnitJson, ablunitConfig } from "../ABLUnitConfigWriter"


export interface TCFailure {
	callstackRaw: string
	callstack: ICallStack
	message: string
	type: string
	diff?: {
		expectedOutput: string
		actualOutput: string
	}
}

export interface TestCase {
	name: string
	classname?: string
	status: string
	time: number
	failure?: TCFailure
}

export interface TestSuite {
	name?: string
	classname?: string
	id: number
	tests: number
	errors: number
	failures: number
	skipped: number
	time: number
	testsuite?: TestSuite[]
	properties?: { [key: string]: string }
	testcases?: TestCase[]
}

export interface TestSuites {
	name: string
	tests: number
	errors: number
	failures: number
	testsuite?: TestSuite[]
}

export class ABLResultsParser {
	resultsJson: TestSuites[] = []
	propath: PropathParser
	debugLines: ABLDebugLines

	constructor(propath: PropathParser, debugLines: ABLDebugLines) {
		this.propath = propath
		this.debugLines = debugLines
	}

	async parseResults(opts: IABLUnitJson, resultsUri: Uri, jsonUri: Uri) {
		console.log("resultsUri=" + resultsUri.fsPath)
		const resultsBits = await workspace.fs.readFile(resultsUri);
		const resultsXml = Buffer.from(resultsBits.toString()).toString('utf8');
		const resultsXmlJson = await this.parseXml(resultsXml)
		try {
			this.resultsJson = [ await this.parseSuites(resultsXmlJson) ]
		} catch (err) {
			console.error("[parseResults] error parsing results.xml file: " + err)
			throw err
		}
		if (ablunitConfig.config_output_writeJson) {
			this.writeJsonToFile(jsonUri)
		}
	}

	parseXml(xmlData: string) {
		const parseString = xml2js.parseString;
		let res: any

		parseString(xmlData, function (err: any, resultsRaw: any) {
			if (err) {
				throw new Error("error parsing XML file: " + err)
			}
			res = resultsRaw
			return String(resultsRaw)
		})
		return res
	}

	async parseSuites(res: any) {
		if(!res.testsuites) {
			throw new Error("malformed results file (1) - could not find top-level 'testsuites' node")
		}
		res = res.testsuites

		const testsuite = await this.parseSuite(res.testsuite)
		const jsonData: TestSuites = {
			name: res['$'].name,
			tests: Number(res['$'].tests),
			failures: Number(res['$'].failures),
			errors: Number(res['$'].errors),
			testsuite: testsuite
		}
		return jsonData
	}

	async parseSuite(res: any) {
		if (!res) { return undefined }
		const suites: TestSuite[] = []

		for (let idx=0; idx<res.length; idx++) {
			const testsuite = await this.parseSuite(res[idx].testsuite).then()
			const testcases = await this.parseTestCases(res[idx].testcase).then()
			suites[idx] = {
				name: res[idx]['$'].name ?? undefined,
				classname: res[idx]['$'].classname ?? undefined,
				id: res[idx]['$'].id,
				tests: Number(res[idx]['$'].tests),
				errors: Number(res[idx]['$'].errors),
				failures: Number(res[idx]['$'].failures),
				skipped: Number(res[idx]['$'].skipped),
				time: Number(res[idx]['$'].time * 1000),
				properties: this.parseProperties(res[idx].properties),
				testsuite: testsuite,
				testcases: testcases
			}
		}
		return suites
	}

	parseProperties(res: any) {
		if (!res){ return undefined }
		res = res[0].property
		const props: { [key: string]: string } = {}

		for(const element of res) {
			props[element['$'].name] = element['$'].value
		}
		return props
	}

	async parseTestCases(res: any) {
		if (!res) { return undefined }
		const cases: TestCase[] = []

		for (let idx=0; idx<res.length; idx++) {
			cases[idx] = {
				name: res[idx]['$'].name,
				classname: res[idx]['$'].classname ?? undefined,
				status: res[idx]['$'].status,
				time: Number(res[idx]['$'].time),
				failure: await this.parseFailOrError(res[idx])
			}
		}
		return cases
	}

	async parseFailOrError(res: any) {
		if (res['$'].status === "Success" || res['$'].status === "Skipped") {
			return undefined
		}
		let type = ''

		if (res['failure']) {
			type = "failure"
		} else if (res['error']){
			type = "error"
		} else {
			throw new Error("malformed results  file (3) - could not find 'failure' or 'error' node")
		}
		if (res[type].length > 1) { throw new Error("more than one failure or error in testcase - use case not handled") }

		const callstack = await parseCallstack(this.debugLines, res[type][0]['_'])
		const fail: TCFailure = {
			callstackRaw: res[type][0]['_'],
			callstack: callstack,
			message: res[type][0]['$'].message,
			type: res[type][0]['$'].types
		}
		const diffRE = /Expected: (.*) but was: (.*)/
		const diff = diffRE.exec(res[type][0]['$'].message)
		if (diff) {
			fail.diff = {
				expectedOutput: diff[1],
				actualOutput: diff[2]
			}
		}
		return fail
	}

	writeJsonToFile(uri: Uri) {
		const data = this.resultsJson
		workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			console.log("wrote results json file: " + uri.fsPath)
		}, (err) => {
			console.error("failed to write profile output json file " + uri.fsPath + " - " + err)
		})
	}
}

// console.log(1)
// var parseTest = new ABLResultsParser("c:/git/ablunit-test-provider/test_projects/proj2/results.xml")
// console.log(2)
