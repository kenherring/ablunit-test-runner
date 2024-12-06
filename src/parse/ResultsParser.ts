/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { TestMessageStackFrame, Uri, workspace } from 'vscode'
import { parseCallstack, ICallStack } from './CallStackParser'
import { PropathParser } from '../ABLPropath'
import { parseString } from 'xml2js'
import { ABLDebugLines } from '../ABLDebugLines'
import { log } from '../ChannelLogger'
import { isRelativePath } from '../ABLUnitCommon'

export interface ITestCaseFailure {
	callstackRaw: string
	callstack: ICallStack
	stackTrace: TestMessageStackFrame[]
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
	failures?: ITestCaseFailure[]
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

	constructor (propath?: PropathParser, debugLines?: ABLDebugLines) {
		if (propath) {
			this.propath = propath
		} else {
			this.propath = new PropathParser(workspace.workspaceFolders![0])
		}
		if (debugLines) {
			this.debugLines = debugLines
		} else {
			this.debugLines = new ABLDebugLines(this.propath)
		}
	}

	async parseResults (configUri: Uri, jsonUri?: Uri) {
		const resultsBits = await workspace.fs.readFile(configUri)
		const resultsXml = Buffer.from(resultsBits.toString()).toString('utf8')
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
		const resultsXmlJson = this.parseXml(resultsXml)
		try {
			this.resultsJson = [ await this.parseSuites(resultsXmlJson) ]
		} catch (err) {
			log.error('[parseResults] error parsing ' + configUri.fsPath + ' file: ' + err)
			throw err
		}
		if (jsonUri) {
			return this.writeJsonToFile(jsonUri)
		}
	}

	parseXml (xmlData: string): string {
		let res: string | undefined

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		parseString(xmlData, (e: Error | null, resultsRaw: unknown) => {
			if (e) {
				log.info('error parsing XML file: ' + e)
				throw e
			}
			if (!resultsRaw) {
				throw new Error('malformed results file (2) - could not parse XML - resultsRaw is null')
			}
			if (typeof resultsRaw === 'object' && resultsRaw !== null) {
				res = JSON.stringify(resultsRaw)
				return JSON.stringify(resultsRaw)
			}
			log.error('resultsRaw=' + JSON.stringify(resultsRaw))
			throw new Error('malformed results file (2) - could not parse XML - resultsRaw is not an object')
		})
		if (!res) {
			throw new Error('malformed results file (2) - could not parse XML')
		}
		return res
	}

	async parseSuites (results: string) {
		if (!results) {
			throw new Error('malformed results file (1) - res is null')
		}
		let res = JSON.parse(results)
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
			passed: Number(res.$.tests) - Number(res.$.errors) - Number(res.$.failures) - Number(res.$.skipped ?? 0),
			failures: Number(res.$.failures),
			errors: Number(res.$.errors),
			skipped: Number(res.$.skipped ?? 0),
			testsuite: testsuite
		}

		if (jsonData.passed === null) {
			log.info('res.$.tests=' + res.$.tests)
			log.info('res.$.errors' + res.$.errors)
			log.info('res.$.failures' + res.$.failures)
			log.info('res.$.skipped' + res.$.skipped)
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
				passed: Number(res[idx].$.tests) - Number(res[idx].$.errors) - Number(res[idx].$.failures) - Number(res[idx].$.skipped ?? 0),
				errors: Number(res[idx].$.errors),
				failures: Number(res[idx].$.failures),
				skipped: Number(res[idx].$.skipped ?? 0),
				time: Number(res[idx].$.time * 1000),
				properties: this.parseProperties(res[idx].properties),
				testsuite: testsuite,
				testcases: testcases
			}
			if (suites[idx].passed === null) {
				log.info('res[idx].$.tests=' + res[idx].$.tests)
				log.info('res[idx].$.errors' + res[idx].$.errors)
				log.info('res[idx].$.failures' + res[idx].$.failures)
				log.info('res[idx].$.skipped' + res[idx].$.skipped)
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
				failures: await this.parseFailOrError(res[idx]),
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

	callstackToStackFrame (callstack: ICallStack) {
		const stackFrames: TestMessageStackFrame[] = []
		for (const i of callstack.items) {
			stackFrames.push(new TestMessageStackFrame(i.rawText, i.loc?.uri, i.position))
		}
		return stackFrames
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
			// there's a 'message' atttribute in skipped we might want to parse
			return
		} else {
			throw new Error('malformed results  file (3) - could not find \'failure\' or \'error\' or \'skipped\' node')
		}

		const fails: ITestCaseFailure[] = []
		for (const result of res[type]) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const callstack = await parseCallstack(this.debugLines, result._)
			const stackTrace = this.callstackToStackFrame(callstack)
			const fail: ITestCaseFailure = {
				callstackRaw: result._,
				callstack: callstack,
				stackTrace: stackTrace,
				message: result.$.message,
				type: result.$.types
			}
			const diffRE = /Expected: (.*) but was: (.*)/
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const diff = diffRE.exec(result.$.message)
			if (diff) {
				fail.diff = {
					expectedOutput: diff[1],
					actualOutput: diff[2]
				}
			}
			fails.push(fail)
		}
		if (fails.length === 0) {
			return undefined
		}
		return fails
	}

	writeJsonToFile (uri: Uri) {
		const data = this.resultsJson
		log.info('writing results json file: ' + uri.fsPath)
		return workspace.fs.writeFile(uri, Uint8Array.from(Buffer.from(JSON.stringify(data, null, 2)))).then(() => {
			log.info('wrote results json file: ' + uri.fsPath)
			return
		}, (e: unknown) => {
			log.error('failed to write profile output json file ' + uri.fsPath + ' - ' + e)
		})
	}
}
