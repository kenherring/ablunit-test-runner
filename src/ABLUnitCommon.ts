import { TestRun, window } from 'vscode'

const logOutputChannel = window.createOutputChannel('ABLUnit', {log: true })
logOutputChannel.clear()

export function logToChannel (message: string, consoleMessageType: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'log' | '' = 'info', options?: TestRun) {
	if (consoleMessageType === '' || consoleMessageType === 'log') {
		consoleMessageType = 'info'
	}

	if (options) {
		const optMsg = message.replace(/\r/g, '').replace(/\n/g, '\r\n')
		options.appendOutput(optMsg + "\r\n")
	}

	switch (consoleMessageType) {
		case 'trace':
			console.trace(message)
			logOutputChannel.trace(message)
			break
		case 'debug':
			console.debug(message)
			logOutputChannel.debug(message)
			break
		case 'info':
			console.log(message)
			logOutputChannel.appendLine(message)
			break
		case 'warn':
			console.warn(message)
			logOutputChannel.warn(message)
			break
		case 'error':
			console.error(message)
			logOutputChannel.error(message)
			break
		default:
			console.log(message)
			if (consoleMessageType != '' && consoleMessageType != 'log') {
				console.warn("WARNING: consoleMessageType not recognized - '" + consoleMessageType + "'")
			}
			logOutputChannel.appendLine(message)
			break
	}
}
