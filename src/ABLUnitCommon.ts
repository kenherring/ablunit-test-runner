/* eslint-disable no-console */
import { LogLevel, TestRun, Uri, window } from 'vscode'
import path from 'path'
import * as fs from 'fs'
// @ts-expect-error 123
import JSON_minify from 'node-json-minify'

const logOutputChannel = window.createOutputChannel('ABLUnit', { log: true })
logOutputChannel.clear()

class Logger {

	level = logOutputChannel.logLevel

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	trace (message: string, testRun?: TestRun) {
		if (this.level < LogLevel.Trace) { return }
		message = this.decorateMessage(message)
		// this.logTestConsole(message, testRun)
		// console.trace(message)
		logOutputChannel.trace(message)
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	debug (message: string, testRun?: TestRun) {
		if (this.level < LogLevel.Debug) { return }
		message = this.decorateMessage(message)
		// this.logTestConsole(message, testRun)
		console.debug(message)
		logOutputChannel.debug(message)
	}

	info (message: string, testRun?: TestRun) {
		if (this.level < LogLevel.Info) { return }
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.log(message)
		logOutputChannel.info(message)
	}

	warn (message: string, testRun?: TestRun) {
		if (this.level < LogLevel.Warning) { return }
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.warn(message)
		logOutputChannel.warn(message)
	}


	error (message: string | Error, testRun?: TestRun) {
		if (this.level < LogLevel.Error) { return }
		if (message instanceof Error) {
			if (message.stack) {
				message = '[' + message.name + '] ' +  message.message + "\r\r" + message.stack
			} else {
				message = '[' + message.name + '] ' +  message.message
			}
		}
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.error(message)
		logOutputChannel.error(message)
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
			const now = new Date()
			return '[' + now.toISOString() + '] [' + callerSourceLine + '] ' + message
		}
		return message
	}

	private logTestConsole (message: string, testRun: TestRun | undefined) {
		if (!testRun) { return }
		const optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		testRun.appendOutput(optMsg + "\r\n")
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
