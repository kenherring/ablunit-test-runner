/* eslint-disable no-console */
import { LogLevel, TestRun, window } from 'vscode'
import path from 'path'

class Logger {
	private static instance: Logger

	private readonly logOutputChannel
	private readonly consoleLogLevel = LogLevel.Debug
	private readonly testResultsLogLevel = LogLevel.Info
	private logLevel: number
	private testResultsTimestamp = false

	private constructor () {
		this.logLevel = LogLevel.Info
		this.logOutputChannel = window.createOutputChannel('ABLUnit', { log: true })
		this.logOutputChannel.clear()
		this.info('ABLUnit output channel created (logLevel=' + this.logOutputChannel.logLevel + ')')
		this.logOutputChannel.onDidChangeLogLevel((e) => { this.setLogLevel(e) })
	}

	public static getInstance () {
		if (!Logger.instance) {
			Logger.instance = new Logger()
		}
		Logger.instance.clearOutputChannel()
		return Logger.instance
	}

	clearOutputChannel () {
		this.logOutputChannel.clear()
	}

	setLogLevel (e: LogLevel) {
		const message = 'ABLUnit ogLevel changed from ' + this.logLevel + ' to ' + e
		console.log(message)
		this.logOutputChannel.appendLine(message)
		this.logLevel = e
	}

	setTestResultsTimestamp (e: boolean) {
		this.testResultsTimestamp = e
	}

	trace (message: string, testRun?: TestRun, stackTrace = true) {
		this.writeMessage(LogLevel.Trace, message, testRun, stackTrace)
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
				message = '[' + message.name + '] ' +  message.message + '\r\r' + message.stack
			} else {
				message = '[' + message.name + '] ' +  message.message
			}
		}
		this.writeMessage(LogLevel.Error, message, testRun)
	}

	notification (message: string) {
		log.info(message)
		return window.showInformationMessage(message)
	}

	notificationError (message: string) {
		log.error(message)
		return window.showErrorMessage(message)
	}

	private writeMessage (messageLevel: LogLevel, message: string, testRun?: TestRun, includeStack = false) {
		this.writeToChannel(messageLevel, message, includeStack)

		if (testRun && messageLevel >= this.testResultsLogLevel) {
			this.writeToTestResults(message, testRun, includeStack)
		}

		if (messageLevel >= this.consoleLogLevel) {
			this.writeToConsole(messageLevel, message, includeStack)
		}
	}

	private writeToChannel (messageLevel: LogLevel, message: string, includeStack: boolean) {
		message = '[' + this.getFunction() + '] ' + message
		switch (messageLevel) {
			case LogLevel.Trace:
				if(includeStack) { this.logOutputChannel.debug('Trace: ' + message); break }
				else { this.logOutputChannel.trace(message); break }
			case LogLevel.Debug:	this.logOutputChannel.debug(message); break
			case LogLevel.Info:		this.logOutputChannel.info(message); break
			case LogLevel.Warning:	this.logOutputChannel.warn(message); break
			case LogLevel.Error:	this.logOutputChannel.error(message); break
			default:
				this.logOutputChannel.appendLine(message)
				throw new Error('invalid log level for message! level=' + messageLevel + ', message=' + message)
		}
	}

	private writeToTestResults (message: string, testRun: TestRun, includeStack: boolean) {
		if (this.testResultsTimestamp) {
			message = '[' + new Date().toISOString() + '] ' + message
		}
		let optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')

		if (includeStack) {
			const prepareStackTraceOrg = Error.prepareStackTrace
			const err = new Error()
			Error.prepareStackTrace = (_, stack) => stack
			const stack = err.stack as unknown as NodeJS.CallSite[]
			Error.prepareStackTrace = prepareStackTraceOrg
			optMsg = optMsg + '\r\n' + stack
		}

		testRun.appendOutput(optMsg + '\r\n')
	}

	private writeToConsole (messageLevel: LogLevel, message: string, includeStack: boolean) {
		message = this.decorateMessage(message, includeStack)
		switch (messageLevel) {
			case LogLevel.Trace:
				if (includeStack) { console.trace(message) }
				else { console.debug('Trace: ' + message) }
				break
			case LogLevel.Debug:    console.debug(message); break
			case LogLevel.Info:     console.info(message); break
			case LogLevel.Warning:  console.warn(message); break
			case LogLevel.Error:    console.error(message); break
			default:                console.log(message); break
		}
	}

	private getFunction () {
		const prepareStackTraceOrg = Error.prepareStackTrace
		const err = new Error()
		Error.prepareStackTrace = (_, stack) => stack
		const stack = err.stack as unknown as NodeJS.CallSite[]
		Error.prepareStackTrace = prepareStackTraceOrg

		for (const s of stack) {
			if (s.getTypeName() !== 'Logger') {
				return (s.getMethodName() ?? s.getFunctionName()) + ':' + s.getLineNumber()
			}
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
			if (filename && filename !== __filename && !filename.endsWith('extensionHostProcess.js')) {
				const funcname = s.getFunctionName()
				let ret = filename.replace(path.normalize(__dirname), '').substring(1).replace(/\\/g, '/') + ':' + s.getLineNumber()
				if (funcname) {
					ret = ret + ' ' + funcname
				}
				return ret
			}
		}
	}

	private decorateMessage (message: string, includeStack = false) {
		if (includeStack) {
			return message
		}
		const callerSourceLine = this.getCallerSourceLine()
		if (callerSourceLine) {
			return '[' + callerSourceLine + '] ' + message
		}
		return message
	}

}

export const log = Logger.getInstance()
