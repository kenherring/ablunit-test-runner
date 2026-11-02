import {
	CancellationToken, Disposable,
	LanguageModelTextPart, LanguageModelTool, LanguageModelToolInvocationOptions, LanguageModelToolInvocationPrepareOptions, LanguageModelToolResult,
	TestItem, TestMessageStackFrame, Uri,
	lm, workspace,
} from 'vscode'
import { ABLResults } from 'ABLResults'
import { ABLCompilerError, ABLUnitRuntimeError } from 'Errors'
import { gatherAllTestItems } from 'ABLUnitCommon'
import { ITestCase, ITestSuite } from 'parse/ResultsParser'
import { log } from 'ChannelLogger'

// Language Model tools contributed in package.json (contributes.languageModelTools).  They can be
// invoked by chat agents (e.g. Copilot agent mode) and by other extensions via lm.invokeTool, such
// as MCP bridges exposing the tests to external agents.
//
// Results are returned as plain text rather than JSON: the consumer is a language model, and
// text keeps the output short for large test runs.

// Input shapes must match the inputSchema entries in package.json
export interface IListTestsInput {
	fileUri?: string
}

export interface IRunTestsInput {
	fileUri?: string
	testName?: string
}

/**
 * Operations the language model tools need from the extension. Implemented
 * in extension.ts, where the test controller and the test run logic live.
 */
export interface ILanguageModelToolHost {
	/** Parses the file if needed and returns its test item, or undefined when the file has no tests or is excluded. */
	resolveTestFile: (uri: Uri) => Promise<TestItem | undefined>
	/** Returns the top-level test items, discovering the workspace tests first when the tree is empty. */
	getRootTestItems: (token: CancellationToken) => Promise<TestItem[]>
	/** Runs the given tests (all tests when undefined) with the 'Run Tests' profile and resolves with the results. */
	runTests: (include: TestItem[] | undefined, token: CancellationToken) => Promise<ABLResults[]>
}

export function registerLanguageModelTools (host: ILanguageModelToolHost): Disposable[] {
	return [
		lm.registerTool('ablunit_list_tests', new ListTestsTool(host)),
		lm.registerTool('ablunit_run_tests', new RunTestsTool(host)),
	]
}

// Accepts a URI (file:///...), an absolute path (C:\... or /...), or a path relative to the
// first workspace folder, since models and callers are not consistent about which they send
function toUri (fileUri: string) {
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(fileUri)) {
		return Uri.parse(fileUri)
	}
	if (/^([a-zA-Z]:)?[\\/]/.test(fileUri)) {
		return Uri.file(fileUri)
	}
	const workspaceFolder = workspace.workspaceFolders?.[0]
	if (!workspaceFolder) {
		throw new Error('cannot resolve relative path "' + fileUri + '": no workspace folder is open')
	}
	return Uri.joinPath(workspaceFolder.uri, fileUri)
}

function textResult (text: string) {
	return new LanguageModelToolResult([new LanguageModelTextPart(text)])
}

function relativePath (uri: Uri | undefined) {
	return uri ? workspace.asRelativePath(uri, false) : '<unknown>'
}

class ListTestsTool implements LanguageModelTool<IListTestsInput> {
	constructor (private readonly host: ILanguageModelToolHost) {}

	// No confirmationMessages: VS Code already asks for confirmation before running extension
	// tools in agent mode, and a prompt would block callers invoking the tool without a chat session
	prepareInvocation (options: LanguageModelToolInvocationPrepareOptions<IListTestsInput>) {
		return { invocationMessage: 'Listing ABLUnit tests' + (options.input.fileUri ? ' in ' + options.input.fileUri : '') }
	}

	async invoke (options: LanguageModelToolInvocationOptions<IListTestsInput>, token: CancellationToken) {
		log.info('[ablunit_list_tests] input=' + JSON.stringify(options.input))
		let roots: TestItem[]
		if (options.input.fileUri) {
			const uri = toUri(options.input.fileUri)
			const item = await this.host.resolveTestFile(uri)
			if (!item) {
				return textResult(noTestsInFileMessage(uri))
			}
			roots = [item]
		} else {
			roots = await this.host.getRootTestItems(token)
		}

		const lines: string[] = []
		const appendItem = (item: TestItem, depth: number) => {
			let line = '  '.repeat(depth) + item.label
			if (item.description) {
				line += ' (' + item.description + ')'
			}
			// the path is only printed when it changes (dir -> file), not for each test method in a file
			if (depth === 0 || item.parent?.uri?.fsPath !== item.uri?.fsPath) {
				line += ' - ' + relativePath(item.uri)
			}
			lines.push(line)
			item.children.forEach(child => { appendItem(child, depth + 1) })
		}
		for (const root of roots) {
			appendItem(root, 0)
		}

		if (lines.length === 0) {
			return textResult('No ABLUnit tests found in the workspace (check the ablunit.files.include and ablunit.files.exclude settings).')
		}
		return textResult(lines.join('\n'))
	}
}

class RunTestsTool implements LanguageModelTool<IRunTestsInput> {
	constructor (private readonly host: ILanguageModelToolHost) {}

	prepareInvocation (options: LanguageModelToolInvocationPrepareOptions<IRunTestsInput>) {
		let target = 'all ABLUnit tests'
		if (options.input.fileUri) {
			target = 'ABLUnit tests in ' + options.input.fileUri
			if (options.input.testName) {
				target = 'ABLUnit test ' + options.input.testName + ' in ' + options.input.fileUri
			}
		}
		return { invocationMessage: 'Running ' + target }
	}

	async invoke (options: LanguageModelToolInvocationOptions<IRunTestsInput>, token: CancellationToken) {
		log.info('[ablunit_run_tests] input=' + JSON.stringify(options.input))
		const { fileUri, testName } = options.input

		let include: TestItem[] | undefined = undefined
		if (fileUri) {
			const uri = toUri(fileUri)
			const fileItem = await this.host.resolveTestFile(uri)
			if (!fileItem) {
				return textResult(noTestsInFileMessage(uri))
			}
			include = [fileItem]
			if (testName) {
				// search all descendants: test suites nest classes/programs before the test methods.
				// case-insensitive like ABL identifiers.  Several matches (same name in different
				// classes of a suite) are all run.
				include = gatherAllTestItems(fileItem.children)
					.filter(item => item.label.toLowerCase() === testName.toLowerCase())
				if (include.length === 0) {
					const available = gatherAllTestItems(fileItem.children).map(item => item.label)
					return textResult('No test named "' + testName + '" found in ' + relativePath(uri) + '.'
						+ ' Available tests: ' + (available.length > 0 ? available.join(', ') : '(none)'))
				}
			}
		} else if (testName) {
			return textResult('"testName" requires "fileUri": pass the file that contains the test.')
		} else if ((await this.host.getRootTestItems(token)).length === 0) {
			// report it here: startTestRun with no tests fails with an unhelpful error
			return textResult('No ABLUnit tests found in the workspace (check the ablunit.files.include and ablunit.files.exclude settings).')
		}

		try {
			const results = await this.host.runTests(include, token)
			return textResult(formatResults(results))
		} catch (e: unknown) {
			// return the error as a result instead of throwing, so the model gets the compile
			// errors or the runtime error and can act on them
			log.error('[ablunit_run_tests] test run failed: ' + e)
			return textResult(formatRunError(e))
		}
	}
}

function noTestsInFileMessage (uri: Uri) {
	return 'No ABLUnit tests found in ' + relativePath(uri)
		+ '. The file may not exist, may not contain @Test annotations, or may be excluded by the ablunit.files.include/ablunit.files.exclude settings.'
}

function formatStackFrame (frame: TestMessageStackFrame) {
	let ret = '      at ' + frame.label
	if (frame.uri) {
		ret += ' (' + relativePath(frame.uri)
		if (frame.position) {
			// Position is 0-based, editors and compiler messages are 1-based
			ret += ':' + (frame.position.line + 1)
		}
		ret += ')'
	}
	return ret
}

function formatTestCase (tc: ITestCase, suiteName: string | undefined, lines: string[]) {
	const status = tc.status.toLowerCase()
	if (status === 'success') {
		return
	}
	const name = (suiteName ? suiteName + ' > ' : '') + tc.name
	if (tc.skipped || status === 'skipped' || status === 'ignored') {
		lines.push('SKIPPED ' + name)
		return
	}
	lines.push(status.toUpperCase() + ' ' + name)
	for (const failure of tc.failures ?? []) {
		// raw message rather than getPromsgText(), which returns markdown meant for the Test Results view
		lines.push('    ' + failure.message.split('\n').join('\n    '))
		if (failure.diff) {
			lines.push('    expected: ' + failure.diff.expectedOutput)
			lines.push('    actual:   ' + failure.diff.actualOutput)
		}
		for (const frame of failure.stackTrace) {
			lines.push(formatStackFrame(frame))
		}
	}
}

function formatTestSuite (suite: ITestSuite, lines: string[]) {
	const suiteName = suite.classname ?? suite.name
	for (const tc of suite.testcases ?? []) {
		formatTestCase(tc, suiteName, lines)
	}
	for (const child of suite.testsuite ?? []) {
		formatTestSuite(child, lines)
	}
}

/**
 * Renders the results of a test run as plain text: one totals line per
 * workspace folder, followed by the details of every test that did not pass.
 *
 * Reads the parsed ABLUnit results (results.xml) rather than the TestRun
 * state, so the totals are the ones reported by ABLUnit itself. Passed tests
 * are only counted, to keep the output short.
 */
export function formatResults (results: ABLResults[]) {
	const lines: string[] = []
	for (const r of results) {
		const totals = r.ablResults?.resultsJson[0]
		if (!totals) {
			lines.push('No results available for workspace folder ' + r.workspaceFolder.name + (r.statusNote ? ': ' + r.statusNote : ''))
			continue
		}
		lines.push((results.length > 1 ? '[' + r.workspaceFolder.name + '] ' : '')
			+ totals.tests + ' tests, '
			+ totals.passed + ' passed, '
			+ totals.failures + ' failures, '
			+ totals.errors + ' errors, '
			+ totals.skipped + ' skipped'
			+ ' (' + r.duration.toString() + ')')
		for (const suite of totals.testsuite ?? []) {
			formatTestSuite(suite, lines)
		}
	}
	if (lines.length === 0) {
		return 'No tests were run.'
	}
	return lines.join('\n')
}

/**
 * Renders a failed test run (compile errors, ABLUnit runtime errors,
 * timeouts...) as plain text.
 */
export function formatRunError (e: unknown) {
	if (e instanceof ABLCompilerError) {
		const lines = ['Test run failed: compile errors']
		for (const compilerError of e.compilerErrors) {
			for (const m of compilerError.messages) {
				lines.push(m.fileName + ':' + m.row + ':' + m.column + ' ' + m.message)
			}
		}
		return lines.join('\n')
	}
	if (e instanceof ABLUnitRuntimeError) {
		// '<message>' is the placeholder ABLCompilerError passes as promsgError
		return 'Test run failed: ' + e.message + (e.promsgError && e.promsgError !== '<message>' ? '\n' + e.promsgError : '')
	}
	if (e instanceof Error) {
		return 'Test run failed: ' + e.name + ': ' + e.message
	}
	return 'Test run failed: ' + String(e)
}
