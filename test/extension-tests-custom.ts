import { ExtensionContext, window } from 'vscode'

console.log("STARTED extension-tests-custom.ts")

export async function activate (context: ExtensionContext) {
	console.log('ACTIVATE DUMMY EXTENSION!')
	await window.showInformationMessage('ACTIVATE DUMMY EXTENSION!')

	console.log('extensionPath=' + context.extensionPath)
	console.log('extension tests activated!')
}
