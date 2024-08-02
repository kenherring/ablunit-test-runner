/* eslint-disable no-console */
import { LogLevel, TestRun, window } from 'vscode'
import path from 'path'

class Logger {
	private static readonly instance: Logger = new Logger()

	private readonly logOutputChannel
	private readonly consoleLogLevel = LogLevel.Info
	private readonly testResultsLogLevel = LogLevel.Info
	private logLevel: number
	private readonly consoleTimestamp = process.env['ABLUNIT_TEST_RUNNER_UNIT_TESTING'] === 'true'
	private testResultsTimestamp = false

	private constructor () {
		this.logLevel = LogLevel.Info
		this.logOutputChannel = window.createOutputChannel('ABLUnit', { log: true })
		this.logOutputChannel.clear()
		this.info('ABLUnit output channel created (logLevel=' + this.logOutputChannel.logLevel + ')')
		this.logOutputChannel.onDidChangeLogLevel((e) => { this.setLogLevel(e) })

	}

	public static getInstance () {
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

	getLogLevel () {
		return this.logLevel
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
		const datetime = new Date().toISOString()
		this.writeToChannel(messageLevel, message, includeStack)

		if (testRun && messageLevel >= this.testResultsLogLevel) {
			this.writeToTestResults(message, testRun, includeStack, datetime)
		}

		if (messageLevel >= this.consoleLogLevel) {
			this.writeToConsole(messageLevel, message, includeStack, datetime)
		}
	}

	private writeToChannel (messageLevel: LogLevel, message: string, includeStack: boolean) {
		message = '[' + this.getCallerSourceLine() + '] ' + message
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

	private writeToTestResults (message: string, testRun: TestRun, includeStack: boolean, datetime: string) {
		let optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')

		if (includeStack) {
			const prepareStackTraceOrg = Error.prepareStackTrace
			const err = new Error()
			Error.prepareStackTrace = (_, stack) => stack
			const stack = err.stack as unknown as NodeJS.CallSite[]
			Error.prepareStackTrace = prepareStackTraceOrg
			optMsg = optMsg + '\r\n' + stack
		}
		if (this.testResultsTimestamp) {
			optMsg = '[' + datetime + '] [' + this.getCallerSourceLine() + '] ' + optMsg
		}

		testRun.appendOutput(optMsg + '\r\n')
	}

	private writeToConsole (messageLevel: LogLevel, message: string, includeStack: boolean, datetime: string) {
		message = this.decorateMessage(messageLevel, message, includeStack)
		if (this.consoleTimestamp) {
			message = '[' + datetime + '] ' + message
		}
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
				const relpath = path.relative(process.cwd(), filename)
				// console.log('__dirname=' + __dirname)
				// console.log(' filename=' + filename)
				// console.log('  relpath='  + path.relative(process.cwd(), filename))
				// console.log('os.__dirname', process.cwd())
				// console.log('funcname=' + funcname)
				let ret = relpath + ':' + s.getLineNumber()
				if (funcname) {
					ret = ret + ' ' + funcname
				}
				return ret
			}
		}
	}

	private getLevelText (messageLevel: LogLevel) {
		switch (messageLevel) {
			case LogLevel.Off:		return 'Off  '
			case LogLevel.Trace:	return 'Trace'
			case LogLevel.Debug:	return 'Debug'
			case LogLevel.Info:		return 'Info '
			case LogLevel.Warning:	return 'Warn '
			case LogLevel.Error:	return 'Error'
		}
	}


	private decorateMessage (messageLevel: LogLevel, message: string, includeStack = false) {
		if (includeStack) {
			return '[' + this.getLevelText(messageLevel) + '] ' + message
		}
		return '[' + this.getLevelText(messageLevel) + '] [' + this.getCallerSourceLine() + '] '  + message
	}

}

export const log = Logger.getInstance()
