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
		logToChannel(this.getPrefix() + ' ' + message, 'info', testRun)
	}
	warn (message: string, testRun?: TestRun) {
		logToChannel(this.getPrefix() + ' ' + message, 'warn', testRun)
	}
	debug (message: string, testRun?: TestRun) {
		logToChannel(this.getPrefix() + ' ' + message, 'debug', testRun)
	}
	trace (message: string, testRun?: TestRun) {
		logToChannel(this.getPrefix() + ' ' + message, 'trace', testRun)
	}
	error (message: string, testRun?: TestRun) {
		logToChannel(this.getPrefix() + ' ' + message, 'error', testRun)
	}
	getPrefix () {
		return '[' + path.normalize(__dirname + "/..").replace(/\\/g, '/') + ']'
	}
}

export const log = new Logger()

export function logToChannel (message: string, consoleMessageType: 'trace' | 'debug' | 'info' | 'warn' | 'error' = 'info', options?: TestRun) {
	if (options) {
		const optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		options.appendOutput(optMsg + "\r\n")
	}

	switch (consoleMessageType) {
		case 'trace':
			console.trace(message)
			logOutputChannel.trace(message)
			break
		case 'error':
			console.error(message)
			logOutputChannel.error(message)
			break
		case 'debug':
			console.debug(message)
			logOutputChannel.debug(message)
			break
		case 'warn':
			console.warn(message)
			logOutputChannel.warn(message)
			break
		case 'info':
			console.log(message)
			logOutputChannel.info(message)
			break
		default:
			if (consoleMessageType != '' && consoleMessageType != 'log') {
				log.warn("WARNING: consoleMessageType not recognized - '" + consoleMessageType + "'")
			}
			console.log(message)
			logOutputChannel.appendLine(message)
			break
	}
}

export const readStrippedJsonFile = (uri: Uri | string): JSON => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret: JSON = JSON.parse(JSON_minify(contents))
	return ret
}
