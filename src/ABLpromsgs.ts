import { Uri, workspace } from "vscode";

interface promsg {
	msgnum: number
	msgtext: string
	extraText: string[]
}

class ABLPromsgs {
	DLC = process.env.DLC
	promsgs: promsg[]

	fs = require('fs');

	constructor() {
		console.log("DLC=" + this.DLC)
		this.promsgs = []

		if(! this.DLC) {
			console.log("DLC not set")
			return
		}
		const dlcUri = Uri.joinPath(Uri.parse(this.DLC))
		const promsgDirUri = Uri.joinPath(dlcUri,"prohelp/msgdata")

		const dirFiles = this.fs.readdirSync(promsgDirUri.fsPath)

		dirFiles.forEach((file: string) => {
			if (file == "msg287")
				this.loadPromsgFile(Uri.joinPath(promsgDirUri,file))
		})

		// dirFiles.forEach((file) => {
		// 	if (file[0].endsWith(".msg")) {
		// 		this.loadPromsgFile(file[0])
		// 	}
		// })
		// }, (reason) => {
		// })
	}

	
	msgRegex = /^(\d+) "([^"]*)" "([^"]*)" "([^"]*)"/
	
	loadPromsgFile(msgfileUri: Uri) {
		this.fs.readFileSync(msgfileUri.fsPath, "utf8").split('\n').forEach((line: string) => {
			const res = this.msgRegex.exec(line)
			if(res) {
				const [ , msgnumText, msgtext0, msgtext1, msgtext2] = res
				if (msgnumText) {
					const msgnum = Number(msgnumText)

					this.promsgs.push({
						msgnum: msgnum,
						msgtext: msgtext0,
						extraText: [
							msgtext1,
							msgtext2
						]
					})
				} else {
					if (this.promsgs.length > 0) {
						this.promsgs[this.promsgs.length - 1].extraText.push(line)
					}
				}
			}
		})
	}

	getMsgNum (msgnum: number) {
		return this.promsgs.find((msg) => msg.msgnum == msgnum)
	}
}

var promsgs: ABLPromsgs

export function getPromsg(msgnum: number) {
	promsgs = new ABLPromsgs()
	return promsgs.getMsgNum(msgnum)
}