import { MarkdownString, Uri, workspace } from 'vscode'
import { log } from 'ChannelLogger'
import { IDlc } from 'parse/OpenedgeProjectParser'

interface IPromsg {
	msgnum: number
	msgtext: string[]
}

let promsgsObj: ABLPromsgs

export class ABLPromsgs {
	dlc: IDlc
	promsgs: IPromsg[] = []

	constructor (dlc: IDlc, storageUri: Uri) {
		this.dlc = dlc
		const cacheUri = Uri.joinPath(storageUri, 'promsgs.json')
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		promsgsObj = this

		this.loadFromCache(cacheUri).then(() => {
			log.info('promsgs loaded from cache \'' + cacheUri.fsPath + '\'')
			return true
		}, (_e: unknown) => {
			return this.loadFromDLC(dlc)
		}).then((isCache) => {
			if (!isCache) {
				return this.saveCache(cacheUri)
			}
			return
		}, (e: unknown) => {
			log.info('Cannot load promsgs from DLC, e=' + e)
		})
	}

	async loadPromsgFile (msgfile: Uri) {
		const lines = await workspace.fs.readFile(msgfile).then((buffer) => {
			return Buffer.from(buffer).toString('utf8').split('\n')
		}, (e: unknown) => {
			throw new Error('Cannot read promsgs file \'' + msgfile + '\', e=' + e)
		})


		// First, merge lines where necessary
		const newlines: string[] = []
		let currLine = lines[0]
		for (let idx=1 ; idx<lines.length; idx++) {
			if(RegExp(/^(\d+) /).exec(lines[idx])) {
				newlines.push(currLine)
				currLine = lines[idx]
			} else  if(lines[idx].trim() !== '"' && lines[idx].trim() !== '' && lines[idx].trim() !== '" "" ""') {
				currLine += '\\n' + lines[idx]
			}
		}

		// Then, read the lines into our object
		newlines.forEach(line => {
			const s = line.split(' "')

			let msgnum = 0
			const msgtext: string[] = []
			s.forEach((element, index) => {
				if (index === 0) {
					msgnum = Number(element)
				} else {
					const t = element.replace(/"$/g, '')
					if (t.replace(/\r/g, '') != '' && t != '"\r') {
						msgtext.push(t)
					}
				}
			})

			this.promsgs.push({ msgnum: msgnum, msgtext: msgtext })
		})
	}

	loadFromDLC (dlc: IDlc) {
		log.info('reading promsgs from DLC (dlc=' + dlc.uri.fsPath + ')')
		const promsgDir = Uri.joinPath(dlc.uri, 'prohelp/msgdata')
		return workspace.fs.stat(dlc.uri)
			.then(() => {
				return workspace.fs.readDirectory(promsgDir)
			}).then((dirFiles) => {

				const promArr: Promise<void>[] = []
				for (const file of dirFiles) {
					promArr.push(this.loadPromsgFile(Uri.joinPath(promsgDir, file[0])))
				}

				return Promise.all(promArr)
			}).then(() => {
				log.info('promsgs loaded from DLC')
				return
			}, (e: unknown) => {
				throw new Error('Cannot read promsgs directory \'' + promsgDir + '\', e=' + e)
			})
		// }, (e: unknown) => {
		// 	log.info('Cannot find DLC directory \'' + this.dlc.uri.fsPath + '"')
		// 	throw new Error('Cannot find DLC directory \'' + this.dlc.uri.fsPath + '", e=' + e)
		// })
	}

	async loadFromCache (cacheUri: Uri) {
		log.info('load promsgs from cache (cacheUri=' + cacheUri.fsPath + ')')
		await workspace.fs.readFile(cacheUri).then((buffer) => {
			this.promsgs = JSON.parse(Buffer.from(buffer).toString('utf8')) as IPromsg[]
			return
		}, (e: unknown) => {
			throw new Error('Cannot read promsgs file \'' + cacheUri.fsPath + '\', e=' + e)
		})
	}

	saveCache (cacheUri: Uri) {
		log.info('[saveCache] promsgs.length=' + this.promsgs.length)
		if (this.promsgs.length === 0) {
			throw new Error('promsgs not loaded, cannot save cache - zero records found')
		}
		log.info('save promsgs cache file=\'' + cacheUri.fsPath + '\'')
		return workspace.fs.writeFile(cacheUri, Buffer.from(JSON.stringify(this.promsgs, null, 2))).then(() => {
			log.info('saved promsgs cache successfully \'' + cacheUri.fsPath + '\'')
			return
		}, (e: unknown) => {
			throw new Error('error writing promsgs cache file: ' + e)
		})
	}

	getMsgNum (msgnum: number) {
		return this.promsgs.find((msg) => msg.msgnum == msgnum)
	}
}

export function getPromsg (msgnum: number) {
	return promsgsObj.getMsgNum(msgnum)
}

export function getPromsgText (text: string) {
	try {
		const promsgMatch = RegExp(/\((\d+)\)$/).exec(text)
		log.info('text = ' + text)
		log.info('match = ' + JSON.stringify(promsgMatch))
		const promsg = promsgsObj.getMsgNum(Number(promsgMatch![1]))
		log.info('promsg= ' + promsg?.msgnum + ' ' + promsg?.msgtext)
		let stackString = '`' + text + '`'
		if ((promsg?.msgtext.length ?? 0) > 0) {
			stackString += '\n\n---\n\n**Promsg Detail**\n'
		}
		let count = 0
		promsg?.msgtext.forEach((text: string) => {
			if (count === 0) {
				count++
			} else {
				stackString += '\n\n' + text.replace(/\\n/g, '\n\n')
			}
		})

		const mdString = new MarkdownString(stackString)
		return mdString
	} catch (_e: unknown) {
		return text
	}
}
