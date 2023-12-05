import { ExtensionContext, window } from 'vscode'

export async function activate(context: ExtensionContext) {
	console.log("ACTIVATE DUMMY EXTENSION!")
	window.showInformationMessage("ACTIVATE DUMMY EXTENSION!")
}
