import { Uri, workspace } from "vscode"
import * as xml2js from "xml2js"

export interface TCFailure {
	callstack: string
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

interface TestSuite {
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

interface TestSuites {
	name: string
	tests: number
	errors: number
	failures: number
	testsuite?: TestSuite[]
}

export class ABLResultsParser {
	fs = require('fs');
	resultsJson?: TestSuites

	constructor() {}

	async importResults(resultsUri: Uri) {
		const resultsBits = await workspace.fs.readFile(resultsUri);
		const resultsXml = await Buffer.from(resultsBits.toString()).toString('utf8');
		const resultsXmlJson = await this.parseXml(resultsXml)
		this.resultsJson = this.parseSuites(resultsXmlJson)
		this.outputJson(Uri.parse(resultsUri.toString().replace(/\.xml$/,".json")), this.resultsJson)
	}

	parseXml(xmlData: string) {
		const parseString = xml2js.parseString;
		let res: any

		parseString(xmlData, function (err: any, resultsRaw: any) {
			if (err) {
				throw("error parsing XML")
			}
			res = resultsRaw
			return String(resultsRaw)
		})
		return res
	}

	parseSuites(res: any) {
		if(!res['testsuites']) {
			throw "malformed results.xml file - could not find top-level 'testsuites' node"
		}
		res = res['testsuites']

		const jsonData = {
			name: res['$']['name'],
			tests: Number(res['$']['tests']),
			failures: Number(res['$']['failues']),
			errors: Number(res['$']['errors']),
			testsuite: this.parseSuite(res['testsuite'])
		}
		return jsonData
	}

	parseSuite(res: any) {
		if (!res) { return undefined }
		const suites: TestSuite[] = []

		for (let idx=0; idx<res.length; idx++) {
			suites[idx] = {
				name: res[idx]['$']['name'] ?? undefined,
				classname: res[idx]['$']['classname'] ?? undefined,
				id: res[idx]['$']['id'],
				tests: Number(res[idx]['$']['tests']),
				errors: Number(res[idx]['$']['errors']),
				failures: Number(res[idx]['$']['failures']),
				skipped: Number(res[idx]['$']['skipped']),
				time: Number(res[idx]['$']['time'] * 1000),
				properties: this.parseProperties(res[idx]['properties']),
				testsuite: this.parseSuite(res[idx]['testsuite']),
				testcases: this.parseTestCases(res[idx]['testcase'])
			}
		}
		return suites
	}

	parseProperties(res: any) {
		if (!res){ return undefined }
		res = res[0]['property']
		const props: { [key: string]: string } = {}

		for(let idx=0; idx<res.length; idx++) {
			props[res[idx]['$']['name']] = res[idx]['$']['value']
		}
		return props
	}

	parseTestCases(res: any) {
		if (!res) { return undefined }
		const cases: TestCase[] = []

		for (let idx=0; idx<res.length; idx++) {
			cases[idx] = {
				name: res[idx]['$']['name'],
				classname: res[idx]['$']['classname'] ?? undefined,
				status: res[idx]['$']['status'],
				time: Number(res[idx]['$']['time']),
				failure: this.parseFailOrError('failure', res[idx]),
				error: this.parseFailOrError('error', res[idx])
			}
		}
		return cases
	}

	parseFailOrError(type: string, res: any) {
		if (!res[type]) { return undefined }
		return {
			//TODO: can we have more than one failure or error?
			callstack: res[type][0]['_'],
			message: res[type][0]['$']['message'],
			type: res[type][0]['$']['type']
		}
	}

	outputJson(jsonUri: Uri, toJson: any) {
		console.log("outputJson to " + jsonUri.toString())
		const bufferJson = Buffer.from(JSON.stringify(toJson, null, 2))
		workspace.fs.writeFile(jsonUri, bufferJson)
	}
}

// console.log(1)
// var parseTest = new ABLResultsParser("c:/git/ablunit-test-provider/test_projects/proj2/results.xml")
// console.log(2)
