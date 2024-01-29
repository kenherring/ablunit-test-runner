import * as vscode from 'vscode'


vscode.commands.getCommands().then((cmds) => {
	console.log(cmds)
}, (reason) => {
	console.log(reason)
})
