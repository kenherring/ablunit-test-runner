import { Uri, workspace } from "vscode"
import { parseCallstack, ICallStack } from "./parse/ParseCallStack"
import { PropathParser } from "./ABLPropath"
import * as xml2js from "xml2js"
import { ABLDebugLines } from "./ABLDebugLines"


export interface TCFailure {
	callstackRaw: string
	callstack: ICallStack
	message: string
	type: string
}

export interface TestCase {
	name: string
	classname?: string
	status: string
	time: number
	failure?: TCFailure
	error?: TCFailure
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
	fs = require('fs');
	resultsJson?: TestSuites
	propath: PropathParser
	debugLines: ABLDebugLines

	constructor(propath: PropathParser, debugLines: ABLDebugLines) {
		this.propath = propath
		this.debugLines = debugLines
	}

	async importResults(resultsUri: Uri) {
		const resultsBits = await workspace.fs.readFile(resultsUri);
		const resultsXml = Buffer.from(resultsBits.toString()).toString('utf8');
		const resultsXmlJson = await this.parseXml(resultsXml)
		this.resultsJson = await this.parseSuites(resultsXmlJson)
		this.outputJson(Uri.parse(resultsUri.toString().replace(/\.xml$/,".json")), this.resultsJson)
	}

	parseXml(xmlData: string) {
		const parseString = xml2js.parseString;
		let res: any

		parseString(xmlData, function (err: any, resultsRaw: any) {
			if (err) {
				throw(new Error("error parsing XML"))
			}
			res = resultsRaw
			return String(resultsRaw)
		})
		return res
	}

	async parseSuites(res: any) {
		if(!res.testsuites) {
			throw new Error("malformed results.xml file - could not find top-level 'testsuites' node")
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
			const failure = await this.parseFailOrError('failure', res[idx])
			const error = await this.parseFailOrError('error', res[idx])
			cases[idx] = {
				name: res[idx]['$'].name,
				classname: res[idx]['$'].classname ?? undefined,
				status: res[idx]['$'].status,
				time: Number(res[idx]['$'].time),
				failure: failure,
				error: error
			}
		}
		return cases
	}

	async parseFailOrError(type: string, res: any) {
		if (!res[type]) { return undefined }

		if (res[type][1]) {
			throw new Error("more than one failure or error in testcase - use case not handled")
		}

		const callstack = await parseCallstack(this.debugLines, res[type][0]['_'])
		const fail: TCFailure = {
			callstackRaw: res[type][0]['_'],
			callstack: callstack,
			message: res[type][0]['$'].message,
			type: res[type][0]['$'].types
		}
		return fail
	}

	outputJson(jsonUri: Uri, toJson: any) {
		// console.log("outputJson to " + jsonUri.fsPath)
		const bufferJson = Buffer.from(JSON.stringify(toJson, null, 2))
		workspace.fs.writeFile(jsonUri, bufferJson)
	}
}

// console.log(1)
// var parseTest = new ABLResultsParser("c:/git/ablunit-test-provider/test_projects/proj2/results.xml")
// console.log(2)
