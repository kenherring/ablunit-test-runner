/* eslint-disable no-console */
import { TestRun, Uri, window } from 'vscode'
import path = require('path')
import * as fs from 'fs'
// @ts-expect-error 123
import JSON_minify from 'node-json-minify'

const logOutputChannel = window.createOutputChannel('ABLUnit', {log: true })
logOutputChannel.clear()

class Logger {
	info (message: string, testRun?: TestRun) {
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.log(message)
		logOutputChannel.info(message)
	}
	warn (message: string, testRun?: TestRun) {
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.warn(message)
		logOutputChannel.warn(message)
	}
	debug (message: string, testRun?: TestRun) {
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.debug(message)
		logOutputChannel.debug(message)
	}
	trace (message: string, testRun?: TestRun) {
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.trace(message)
		logOutputChannel.trace(message)
	}
	error (message: string | Error, testRun?: TestRun) {
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

	private _getCallerFile () {
		const prepareStackTraceOrg = Error.prepareStackTrace
		const err = new Error()
		Error.prepareStackTrace = (_, stack) => stack
		const stack = err.stack as unknown as NodeJS.CallSite[]
		Error.prepareStackTrace = prepareStackTraceOrg
		for (const s of stack) {
			const fileName = s.getFileName()
			if (fileName && fileName !== __filename) {
				return fileName.replace(path.normalize(__dirname),'').substring(1).replace(/\\/g, '/')
			}
		}
	}

	private decorateMessage (message: string) {
		const callerFile = this._getCallerFile()
		if (callerFile) {
			return '[' + this._getCallerFile() + '] ' + message
		}
		return message
		// return this.getPrefix() + ' ' + message
	}

	private logTestConsole (message: string, testRun: TestRun | undefined) {
		if (!testRun) { return }
		const optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		testRun.appendOutput(optMsg + "\r\n")
	}

	// getPrefix () {
	// 	let source = path.normalize(__filename)
	// 	source = source.replace(path.normalize(__dirname),'')
	// 	source = source.substring(1)
	// 	return '[' + source + ']'
	// 	// return '[' + path.normalize(__filename).replace(/\\/g, '/') + ']'
	// }
}

export const getPrefix = () => {
	let source = path.normalize(__filename)
	source = source.replace(path.normalize(__dirname),'')
	source = source.substring(1)
	return '[' + source + ']'
}

export const log: Logger = new Logger()

// module.exports = new Logger()

export const readStrippedJsonFile = (uri: Uri | string): JSON => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret: JSON = JSON.parse(JSON_minify(contents))
	return ret
}
