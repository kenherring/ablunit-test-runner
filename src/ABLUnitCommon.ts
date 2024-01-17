/* eslint-disable no-console */
import { TestRun, Uri, window } from 'vscode'
import path from 'path'
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
	error (message: string, testRun?: TestRun) {
		message = this.decorateMessage(message)
		this.logTestConsole(message, testRun)
		console.error(message)
		logOutputChannel.error(message)
	}

	private decorateMessage (message: string) {
		return this.getPrefix() + ' ' + message
	}

	private logTestConsole (message: string, testRun: TestRun | undefined) {
		if (!testRun) { return }
		const optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		testRun.appendOutput(optMsg + "\r\n")
	}

	private getPrefix () {
		return '[' + path.normalize(__dirname + "/..").replace(/\\/g, '/') + ']'
	}
}

export const log = new Logger()

export const readStrippedJsonFile = (uri: Uri | string): JSON => {
	if (typeof uri === 'string') {
		uri = Uri.file(uri)
	}
	const contents = fs.readFileSync(uri.fsPath, 'utf8')
	// eslint-disable-next-line
	const ret: JSON = JSON.parse(JSON_minify(contents))
	return ret
}
