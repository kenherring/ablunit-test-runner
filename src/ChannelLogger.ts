import { LogLevel, TestRun, window } from 'vscode'
import path from 'path'

class Logger {

	private readonly logOutputChannel = window.createOutputChannel('ABLUnit', { log: true })
	private readonly consoleLogLevel = LogLevel.Debug
	private readonly testResultsLogLevel = LogLevel.Info
	private logLevel: number
	private testResultsTimestamp = false

	constructor () {
		this.logLevel = LogLevel.Info
		this.logOutputChannel.clear()
		this.logOutputChannel.appendLine('ABLUnit output channel created')
		console.log('ABLUnit output channel created (logLevel=' + this.logOutputChannel.logLevel + ')')
		this.logOutputChannel.onDidChangeLogLevel((e) => { this.setLogLevel(e) })
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
		if (messageLevel <= this.logOutputChannel.logLevel) { return }
		this.writeToChannel(messageLevel, message)

		if (testRun && messageLevel <= this.testResultsLogLevel) {
			this.writeToTestResults(message, testRun)
		}

		if (messageLevel <= this.consoleLogLevel) {
			this.writeToConsole(messageLevel, message)
		}
	}

	private writeToChannel (messageLevel: LogLevel, message: string) {
		switch (messageLevel) {
			case LogLevel.Error:    this.logOutputChannel.error(message); break
			case LogLevel.Warning:  this.logOutputChannel.warn(message); break
			case LogLevel.Info:     this.logOutputChannel.info(message); break
			case LogLevel.Debug:    this.logOutputChannel.debug(message); break
			case LogLevel.Trace:    this.logOutputChannel.appendLine(message); break
			default:                throw new Error("invalid log level for message! level=" + messageLevel + ", message=" + message)
		}
	}

	private writeToTestResults (message: string, testRun: TestRun) {
		if (this.testResultsTimestamp) {
			message = '[' + (new Date()).toISOString() + '] ' + message
		}
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
				let ret = filename.replace(path.normalize(__dirname),'').substring(1).replace(/\\/g, '/') + ':' + s.getLineNumber()
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
