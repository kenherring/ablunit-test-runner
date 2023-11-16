import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('ABLUnit');

export function logToChannel(message: string, consoleMessageType?: string) {
	if (consoleMessageType === "warn") {
		console.warn(message)
	} else {
		console.log(message)
	}
	outputChannel.appendLine(message)
}
