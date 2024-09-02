/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Uri, workspace } from 'vscode'
import { parseCallstack, ICallStack } from './CallStackParser'
import { PropathParser } from '../ABLPropath'
import { parseString } from 'xml2js'
import { ABLDebugLines } from '../ABLDebugLines'
import { log } from '../ChannelLogger'
import { isRelativePath } from '../ABLUnitCommon'


export interface ITestCaseFailure {
	callstackRaw: string
	callstack: ICallStack
	message: string
	type: string
	diff?: {
		expectedOutput: string
		actualOutput: string
	}
}

export interface ITestCase {
	name: string
	classname?: string
	status: string
	time: number
	failure?: ITestCaseFailure
	skipped: boolean
}

export interface ITestSuite {
	name?: string
	classname?: string
	id: number
	tests: number
	passed: number
	errors: number
	failures: number
	skipped: number
	time: number
	testsuite?: ITestSuite[]
	properties?: Record<string, string>
	testcases?: ITestCase[]
}

export interface ITestSuites {
	name: string
	tests: number
	passed: number
	errors: number
	failures: number
	skipped: number
	testsuite?: ITestSuite[]
}

export class ABLResultsParser {
	resultsJson: ITestSuites[] = []
	propath: PropathParser
	debugLines: ABLDebugLines

	constructor (propath: PropathParser, debugLines: ABLDebugLines) {
		this.propath = propath
		this.debugLines = debugLines
	}

	async parseResults (configUri: Uri, jsonUri: Uri | undefined) {
		const resultsBits = await workspace.fs.readFile(configUri)
		const resultsXml = Buffer.from(resultsBits.toString()).toString('utf8')
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
		const resultsXmlJson = this.parseXml(resultsXml)
		try {
			this.resultsJson = [ await this.parseSuites(resultsXmlJson) ]
		} catch (err) {
			log.error('[parseResults] error parsing results.xml file: ' + err)
			throw err
		}
		if (jsonUri) {
			return this.writeJsonToFile(jsonUri)
		}
	}

	parseXml (xmlData: string): string {
		let res: string | undefined

		parseString(xmlData, function (err: Error | null, resultsRaw: any) {
			if (err) {
				throw new Error('error parsing XML file: ' + err)
			}
			res = resultsRaw
			return String(resultsRaw)
		})
		if (!res) {
			throw new Error('malformed results file (2) - could not parse XML')
		}
		return res
	}

	async parseSuites (res: any) {
		if(!res.testsuites) {
			log.error('malformed results file (1) - could not find top-level \'testsuites\' node')
			throw new Error('malformed results file (1) - could not find top-level \'testsuites\' node')
		}
		res = res.testsuites

		const testsuite = await this.parseSuite(res.testsuite)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		let namePathSep = res.$.name.replace(/\\/g, '/') as string
		if (!isRelativePath(namePathSep)) {
			namePathSep = workspace.asRelativePath(namePathSep, false)
		}
		const jsonData: ITestSuites = {
			name: namePathSep,
			tests: Number(res.$.tests),
			passed: Number(res.$.tests) - Number(res.$.errors) - Number(res.$.failures) - Number(res.$.ignored),
			failures: Number(res.$.failures),
			errors: Number(res.$.errors),
			skipped: Number(res.$.skipped),
			testsuite: testsuite
		}
		return jsonData
	}

	async parseSuite (res: any) {
		if (!res) { return undefined }
		const suites: ITestSuite[] = []

		for (let idx=0; idx<res.length; idx++) {
			const testsuite = await this.parseSuite(res[idx].testsuite)
			const testcases = await this.parseTestCases(res[idx].testcase)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			let namePathSep = res[idx].$.name.replace(/\\/g, '/') as string
			if (!isRelativePath(namePathSep)) {
				namePathSep = workspace.asRelativePath(namePathSep, false)
			}

			suites[idx] = {
				name: namePathSep,
				classname: res[idx].$.classname ?? undefined,
				id: res[idx].$.id,
				tests: Number(res[idx].$.tests),
				passed: Number(res[idx].$.tests) - Number(res[idx].$.errors) - Number(res[idx].$.failures) - Number(res[idx].$.skipped),
				errors: Number(res[idx].$.errors),
				failures: Number(res[idx].$.failures),
				skipped: Number(res[idx].$.skipped),
				time: Number(res[idx].$.time * 1000),
				properties: this.parseProperties(res[idx].properties),
				testsuite: testsuite,
				testcases: testcases
			}
		}
		return suites
	}

	parseProperties (res: any) {
		if (!res) { return undefined }
		res = res[0].property
		const props: Record<string, string> = {}

		for(const element of res) {
			props[element.$.name] = element.$.value
		}
		return props
	}

	async parseTestCases (res: any) {
		if (!res) { return undefined }
		const cases: ITestCase[] = []

		for (let idx=0; idx<res.length; idx++) {
			cases[idx] = {
				name: res[idx].$.name,
				classname: res[idx].$.classname ?? undefined,
				status: res[idx].$.status,
				time: Number(res[idx].$.time),
				failure: await this.parseFailOrError(res[idx]),
				skipped: this.parseSkipped(res[idx]),
			}
		}
		return cases
	}

	parseSkipped (res: any) {
		if (res.$.status === 'Success' && res.$.ignored === 'true') {
			return true
		}
		return false
	}

	async parseFailOrError (res: any) {
		if (res.$.status === 'Success') {
			return undefined
		}
		let type = ''

		if (res.failure) {
			type = 'failure'
		} else if (res.error) {
			type = 'error'
		} else if (res.skipped) {
			type = 'skipped'
		} else {
			throw new Error('malformed results  file (3) - could not find \'failure\' or \'error\' or \'skipped\' node')
		}
		if (res[type].length > 1) { throw new Error('more than one failure or error in testcase - use case not handled') }

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		const callstack = await parseCallstack(this.debugLines, res[type][0]._)
		const fail: ITestCaseFailure = {
			callstackRaw: res[type][0]._,
			callstack: callstack,
			message: res[type][0].$.message,
			type: res[type][0].$.types
		}
		const diffRE = /Expected: (.*) but was: (.*)/
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		const diff = diffRE.exec(res[type][0].$.message)
		if (diff) {
			fail.diff = {
				expectedOutput: diff[1],
				actualOutput: diff[2]
			}
		}
		return fail
	}

	writeJsonToFile (uri: Uri) {
		const data = this.resultsJson
		log.info('writing results json file: ' + uri.fsPath)
		return workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			log.info('wrote results json file: ' + uri.fsPath)
			return
		}, (err) => {
			log.error('failed to write profile output json file ' + uri.fsPath + ' - ' + err)
		})
	}
}
