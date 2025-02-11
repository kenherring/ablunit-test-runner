import { Uri } from 'vscode'

interface ISourceMap {
	sourceUri: Uri,
	path: string,
	items: ISourceMapItem[]
}

export class SourceMap implements ISourceMap {
	sourceUri: Uri
	path: string
	items: SourceMapItem[] = []
	crc?: number

	constructor (sourceUri: Uri, path: string) {
		this.sourceUri = sourceUri
		this.path = path
	}
}

interface ISourceMapItem {
	debugLine: number
	debugUri: Uri
	sourceLine: number
	sourceUri: Uri
	procName: string
	procNum?: number
}

export class SourceMapItem {
	debugLine: number
	debugUri: Uri
	sourceLine: number
	sourceUri: Uri
	procName: string
	procNum?: number

	get sourcePath () {
		return this.sourceUri.fsPath
	}

	constructor (data: ISourceMapItem) {
		this.debugLine = data.debugLine
		this.debugUri = data.debugUri
		this.sourceLine = data.sourceLine
		this.sourceUri = data.sourceUri
		this.procName = data.procName
		this.procNum = data.procNum
	}

	toJSON () {
		return {
			debugLine: this.debugLine,
			debugPath: this.debugUri.fsPath,
			sourceLine: this.sourceLine,
			sourcePath: this.sourceUri.fsPath,
			procName: this.procName
		}
	}

}
