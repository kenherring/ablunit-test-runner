import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('ABLUnit');

export function logToChannel(message: string, consoleMessageType?: string) {
	console.log("consoleMessageType: " + consoleMessageType)
	if (consoleMessageType === "warn") {
		console.warn(message)
	} else if (consoleMessageType === "error") {
		console.error(message)
	} else {
		console.log(message)
	}
	outputChannel.appendLine(message)
}
