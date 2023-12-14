import { TestRun, window } from 'vscode'

const outputChannel = window.createOutputChannel('ABLUnit');

export function logToChannel(message: string, consoleMessageType: 'log' | 'error' | 'warn' | '' = 'log', options?: TestRun) {
	outputChannel.appendLine(message)
	if (consoleMessageType === "warn") {
		console.warn(message)
	} else if (consoleMessageType === "error") {
		console.error(message)
	} else {
		console.log(message)
		if (consoleMessageType != '' && consoleMessageType != 'log') {
			console.warn("WARNING: consoleMessageType not recognized - '" + consoleMessageType + "'")
		}
	}
	if (options) {
		options.appendOutput(message + "\r\n")
	}
}
