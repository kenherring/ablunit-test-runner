/* eslint-disable no-console */
import { LogLevel, TestRun, Uri, window } from 'vscode'
import path from 'path'
import * as fs from 'fs'
// @ts-expect-error 123
import JSON_minify from 'node-json-minify'

const logOutputChannel = window.createOutputChannel('ABLUnit', { log: true })
logOutputChannel.clear()
logOutputChannel.appendLine('ABLUnit output channel created')
console.log("ABLUnit output channel created")

class Logger {

	level: LogLevel = logOutputChannel.logLevel
	consoleLogLevel = LogLevel.Debug
	testResultsLogLevel = LogLevel.Info

	constructor () {
		logOutputChannel.onDidChangeLogLevel((e) => { this.setLogLevel(e) })
		this.level = logOutputChannel.logLevel
	}

	setLogLevel (e: LogLevel) {
		const message = 'logLevel changed from ' + this.level + ' to ' + e
		console.log(message)
		logOutputChannel.appendLine(message)
	}

	trace (message: string, testRun?: TestRun) {
		this.writeMessage(LogLevel.Trace, message, testRun)
	}

	debug (message: string, testRun?: TestRun) {
		this.writeMessage(LogLevel.Debug, message, testRun)
	}

	info (message: string, testRun?: TestRun) {
		this.writeMessage(LogLevel.Info, message, testRun)
	}

	warn (message: string, testRun?: TestRun) {
		this.writeMessage(LogLevel.Warning, message, testRun)
	}

	error (message: string | Error, testRun?: TestRun) {
		if (message instanceof Error) {
			if (message.stack) {
				message = '[' + message.name + '] ' +  message.message + "\r\r" + message.stack
			} else {
				message = '[' + message.name + '] ' +  message.message
			}
		}
		this.writeMessage(LogLevel.Error, message, testRun)
	}


	private writeMessage (messageLevel: LogLevel, message: string, testRun?: TestRun) {
		if (messageLevel <= this.level) { return }
		this.writeToChannel(messageLevel, message)

		if (testRun && messageLevel <= this.testResultsLogLevel) {
			this.writeToTestResults(messageLevel, message, testRun)
		}

		if (messageLevel <= this.consoleLogLevel) {
			this.writeToConsole(messageLevel, message)
		}
	}

	private writeToChannel (messageLevel: LogLevel, message: string) {
		switch (messageLevel) {
			case LogLevel.Error:    logOutputChannel.error(message); break
			case LogLevel.Warning:  logOutputChannel.warn(message); break
			case LogLevel.Info:     logOutputChannel.info(message); break
			case LogLevel.Debug:    logOutputChannel.debug(message); break
			case LogLevel.Trace:    logOutputChannel.appendLine(message); break
			default:                throw new Error("invalid log level for message! level=" + messageLevel + ", message=" + message)
		}
	}

	private writeToTestResults (messageLevel: LogLevel, message: string, testRun: TestRun) {
		message = '[' + messageLevel.toString() + '] [' + (new Date()).toISOString() + '] ' + message
		const optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		testRun.appendOutput(optMsg + "\r\n")
	}

	private writeToConsole (messageLevel: LogLevel, message: string) {
		message = this.decorateMessage(message)
		switch (messageLevel) {
			case LogLevel.Error:    console.error(message); break
			case LogLevel.Warning:  console.warn(message); break
			case LogLevel.Info:     console.info(message); break
			case LogLevel.Debug:    console.debug(message); break
			case LogLevel.Trace:    console.trace(message); break
			default:                console.log(message); break
		}
	}

	private getCallerSourceLine () {
		const prepareStackTraceOrg = Error.prepareStackTrace
		const err = new Error()
		Error.prepareStackTrace = (_, stack) => stack
		const stack = err.stack as unknown as NodeJS.CallSite[]
		Error.prepareStackTrace = prepareStackTraceOrg

		for (const s of stack) {
			const filename = s.getFileName()
			if (filename && filename !== __filename) {
				const funcname = s.getFunctionName()
				let ret = filename.replace(path.normalize(__dirname),'').substring(1).replace(/\\/g, '/')
				ret = filename + ':' + s.getLineNumber()
				if (funcname) {
					ret = ret + ' ' + funcname
				}
				return ret
			}
		}
	}

	private decorateMessage (message: string) {
		const callerSourceLine = this.getCallerSourceLine()
		if (callerSourceLine) {
			return '[' + callerSourceLine + '] ' + message
		}
		return message
	}

}

export const log: Logger = new Logger()

export const readStrippedJsonFile = (uri: Uri | string): JSON => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret: JSON = JSON.parse(JSON_minify(contents))
	return ret
}
