/* eslint-disable no-console */
import { Location, LogLevel, TestItem, TestRun, Uri, window } from 'vscode'

interface ITestInfo {
	testRun: TestRun
	location?: Location
	testItem?: TestItem
}

enum NotificationType {
	Info = 'Info',
	Warn = 'Warn',
	Error = 'Error',
}

class Logger {
	private static instance: Logger

	private readonly logOutputChannel
	private readonly consoleLogLevel = LogLevel.Info
	private readonly testResultsLogLevel = LogLevel.Info
	private logLevel: LogLevel
	private readonly consoleTimestamp = process.env['ABLUNIT_TEST_RUNNER_UNIT_TESTING'] === 'true' || process.env['CIRCLECI']
	private testResultsTimestamp = false
	private readonly extensionCodeDir = __dirname
	private readonly baseDir = __dirname
	notificationsEnabled = true

	private constructor (extCodeDir?: string) {
		this.logLevel = LogLevel.Info
		this.logOutputChannel = window.createOutputChannel('ABLUnit', { log: true })
		this.logOutputChannel.clear()
		this.info('ABLUnit output channel created (logLevel=' + this.logOutputChannel.logLevel + ')')
		this.logOutputChannel.onDidChangeLogLevel((e) => { this.setLogLevel(e) })
		if (extCodeDir) {
			this.extensionCodeDir = extCodeDir
		}
		this.baseDir = Uri.joinPath(Uri.file(this.extensionCodeDir), '..').fsPath
	}
	public static getInstance () {
		Logger.instance = Logger.instance ?? new Logger()
		return Logger.instance
	}

	clearOutputChannel () {
		this.logOutputChannel.clear()
	}

	setLogLevel (e: LogLevel) {
		const message = 'ABLUnit LogLevel changed from ' + this.logLevel + ' to ' + e
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

	trace (message: string, testInfo?: ITestInfo, stackTrace = true) {
		this.writeMessage(LogLevel.Trace, message, testInfo, stackTrace)
	}

	debug (message: string, testInfo?: ITestInfo) {
		this.writeMessage(LogLevel.Debug, message, testInfo)
	}

	info (message: string, testInfo?: ITestInfo) {
		this.writeMessage(LogLevel.Info, message, testInfo)
	}

	warn (message: string, testInfo?: ITestInfo) {
		this.writeMessage(LogLevel.Warning, message, testInfo)
	}

	error (message: string | Error, testInfo?: ITestInfo) {
		if (message instanceof Error) {
			if (message.stack) {
				message = '[' + message.name + '] ' +  message.message + '\r\r' + message.stack
			} else {
				message = '[' + message.name + '] ' +  message.message
			}
		}
		this.writeMessage(LogLevel.Error, message, testInfo)
	}

	private notification (message: string, notificationType: NotificationType = NotificationType.Info) {
		const logMessage = 'NOTIFICATION: ' + message + ' (enabled=' + this.notificationsEnabled + ')'
		switch (notificationType) {
			case NotificationType.Info:
				log.info(logMessage)
				if (this.notificationsEnabled) {
					void window.showInformationMessage(message)
				}
				break
			case NotificationType.Warn:
				log.warn(logMessage)
				void window.showWarningMessage(message)
				break
			case NotificationType.Error:
				log.error(logMessage)
				void window.showErrorMessage(message)
				break
		}
	}

	notificationInfo (message: string) {
		this.notification(message, NotificationType.Info)
	}

	notificationWarning (message: string) {
		this.notification(message, NotificationType.Warn)
	}

	notificationError (message: string) {
		this.notification(message, NotificationType.Error)
	}

	private writeMessage (messageLevel: LogLevel, message: string, testInfo: ITestInfo | undefined, includeStack = false) {
		const datetime = new Date().toISOString()
		this.writeToChannel(messageLevel, message, includeStack)

		if (testInfo && messageLevel >= this.testResultsLogLevel) {
			this.writeToTestResults(message, testInfo, includeStack, datetime)
		}

		if (messageLevel >= this.consoleLogLevel) {
			this.writeToConsole(messageLevel, message, includeStack)
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
			case LogLevel.Off:		break
			default:
				this.logOutputChannel.appendLine(message)
				throw new Error('invalid log level for message! level=' + messageLevel + ', message=' + message)
		}
	}

	private writeToTestResults (message: string, testInfo: ITestInfo, includeStack: boolean, datetime: string) {
		// ensure we're using `\r\n` for line endings
		message = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		if (includeStack) {
			// eslint-disable-next-line @typescript-eslint/unbound-method
			const prepareStackTraceOrg = Error.prepareStackTrace
			const err = new Error()
			Error.prepareStackTrace = (_, stack) => stack
			const stack = err.stack as unknown as NodeJS.CallSite[]
			Error.prepareStackTrace = prepareStackTraceOrg
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			message = message + 'r\n' + stack
		}
		if (this.testResultsTimestamp) {
			message = '[' + datetime + '] [' + this.getCallerSourceLine() + '] ' + message
		}
		if (!message.endsWith('\r\n')) {
			message = message + '\r\n'
		}

		testInfo.testRun.appendOutput(message, testInfo.location, testInfo.testItem)
	}

	private writeToConsole (messageLevel: LogLevel, message: string, includeStack: boolean) {
		message = this.decorateMessage(messageLevel, message, includeStack)
		if (this.consoleTimestamp) {
			message = '[' + new Date().toISOString() + '] ' + message
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
			case LogLevel.Off:	  	break
			default:                console.log(message); break
		}
	}

	private getCallerSourceLine () {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const prepareStackTraceOrg = Error.prepareStackTrace
		const err = new Error()
		Error.prepareStackTrace = (_, stack) => stack
		const stack = err.stack as unknown as NodeJS.CallSite[]
		Error.prepareStackTrace = prepareStackTraceOrg

		for (const s of stack) {
			const classname = s.getTypeName()
			if (classname == 'Logger' || classname == '_Logger') continue
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			let ret = s.toString()
			if (ret.startsWith(this.baseDir)) {
				ret = ret.substring(this.baseDir.length + 1)
			} else {
				const parts = ret.split('(')
				if (parts[0].trim() == 'sleep') {
					continue
				}
				if (parts.length >=2 && parts[1].startsWith(this.extensionCodeDir)) {
					parts[1] =  parts[1].substring(this.extensionCodeDir.length + 1)
					ret = parts.join('(')
				}
			}
			return ret
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
