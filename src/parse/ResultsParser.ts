import { Uri, workspace } from 'vscode'
import { parseCallstack, ICallStack } from './CallStackParser'
import { PropathParser } from '../ABLPropath'
import { parseString } from 'xml2js'
import { ABLDebugLines } from '../ABLDebugLines'
import { IABLUnitConfig } from '../ABLUnitConfigWriter'
import { logToChannel } from '../ABLUnitCommon'


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
	passed: number
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
	passed: number
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

	async parseResults(cfg: IABLUnitConfig) {
		const resultsBits = await workspace.fs.readFile(cfg.config_output_resultsUri);
		const resultsXml = Buffer.from(resultsBits.toString()).toString('utf8');
		const resultsXmlJson = await this.parseXml(resultsXml)
		try {
			this.resultsJson = [ await this.parseSuites(resultsXmlJson) ]
		} catch (err) {
			console.error("[parseResults] error parsing results.xml file: " + err)
			throw err
		}
		console.log("---- cfg.config_output_writeJson=" + cfg.config_output_writeJson)
		console.log("cfg= " + JSON.stringify(cfg))
		console.log("ablunitConfig.configJson.output.location=" + workspace.getConfiguration("ablunit").get("configJson.outputLocation"))
		if (cfg.config_output_writeJson) {
			console.log("2")
			return this.writeJsonToFile(cfg.config_output_jsonUri)
		}
	}

	parseXml(xmlData: string) {
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
			passed: Number(res['$'].tests) - Number(res['$'].errors) - Number(res['$'].failures),
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
				passed: Number(res[idx]['$'].tests) - Number(res[idx]['$'].errors) - Number(res[idx]['$'].failures) - Number(res[idx]['$'].skipped),
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
		console.log("writing results json file: " + uri.fsPath)
		console.log("config-1: " + workspace.getConfiguration("ablunit").get("configJson.outputwriteJson"))
		console.log("config-2: " + workspace.getConfiguration("ablunit").get("configJson.outputLocation"))
		return workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			logToChannel("wrote results json file: " + uri.fsPath)
		}, (err) => {
			logToChannel("failed to write profile output json file " + uri.fsPath + " - " + err,"error")
		})
	}
}
