import { Uri } from "vscode";
import { outputChannel } from "./ABLUnitCommon";

interface Promsg {
	msgnum: number
	msgtext: string[]
}

let promsgsObj: ABLPromsgs

export class ABLPromsgs {
	DLC = process.env.DLC
	promsgs: Promsg[] = []

	//TODO - get rid of this
	fs = require('fs');

	constructor(tempDirUri: Uri) {
		console.log("DLC=" + this.DLC)
		if(! this.fs.existsSync(this.DLC)) {
			outputChannel.appendLine("DLC does not exist")
			console.log("DLC does not exist")
			throw new Error("DLC does not exist")
		}
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		promsgsObj = this

		const cacheUri = Uri.joinPath(tempDirUri,'promsgs.json')

		if (this.fs.existsSync(cacheUri.fsPath)) {
			this.loadFromCache(cacheUri)
			return
		} else {

			const promsgDir = this.DLC + "/prohelp/msgdata"
			const dirFiles = this.fs.readdirSync(promsgDir)
			dirFiles.forEach((file: string) => {
				this.loadPromsgFile(promsgDir + "/" + file)
			})
		}

		this.saveCache(cacheUri)
	}

	loadPromsgFile(msgfile: string) {
		const lines = this.fs.readFileSync(msgfile, "utf8").split('\n')
		const newlines: string[] = []

		//First, merge lines where necessary
		let currLine = lines[0]
		for (let idx=1 ; idx<lines.length; idx++) {
			if(lines[idx].match(/^(\d+) /)) {
				newlines.push(currLine)
				currLine = lines[idx]
			} else  if(lines[idx].trim() !== '"' && lines[idx].trim() !== '' && lines[idx].trim() !== "\" \"\" \"\"") {
				currLine += '\\n' + lines[idx]
			}
		}

		//Then, read the lines into our object
		newlines.forEach(line => {
			const s = line.split(' "')

			let msgnum: number = 0
			const msgtext: string[] = []
			s.forEach((element, index) => {
				if (index === 0) {
					msgnum = Number(element)
				} else {
					const t = element.replace(/"$/g, '')
					if (t != '') {
						msgtext.push(t)
					}
				}
			})

			this.promsgs.push({ msgnum: msgnum, msgtext: msgtext })
		})
	}

	loadFromCache(cacheUri: Uri) {
		console.log("load promsgs from cache")
		outputChannel.appendLine("load promsgs cache")
		this.promsgs = JSON.parse(this.fs.readFileSync(cacheUri.fsPath, "utf8"))
	}

	saveCache(cacheUri: Uri) {
		console.log("save promsgs cache file='" + cacheUri.fsPath + "'")
		outputChannel.appendLine("save promsgs cache")
		this.fs.writeFileSync(cacheUri.fsPath, JSON.stringify(this.promsgs), (err: any) => {
			console.log(1)
			if (err) {
				console.log("Error writing promsgs cache file: " + err)
				outputChannel.appendLine("Error writing promsgs cache file: " + err)
			}
			console.log(2)
		})
		console.log("saved promsgs cache successfully")
	}

	getMsgNum (msgnum: number) {
		return this.promsgs.find((msg) => msg.msgnum == msgnum)
	}
}

export function getPromsg(msgnum: number) {
	return promsgsObj.getMsgNum(msgnum)
}

// console.log("----- start -----")
// console.log(getPromsg(14332))
// console.log("----- end -----")
