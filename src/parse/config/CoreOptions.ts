
interface ICoreOutput {
	location?: string
	filename?: string
	format?: 'xml'
	writeJson?: boolean
	updateFile: string | undefined
}

interface IXrefOptions {
	useXref?: boolean, // default false
	xrefLocation?: string, // default: ${workspaceFolder}
	xrefExtension?: string, // default: xref
	xrefThrowError?: boolean, // default: false
}

export interface ICoreOptions {
	output?: {
		location?: string
		filename?: string
		format?: 'xml'
		writeJson?: boolean
		updateFile: string | undefined
	}
	quitOnEnd?: boolean // = true
	writeLog?: boolean // = true
	showErrorMessage?: boolean // = true
	throwError?: boolean // = true
	xref?: IXrefOptions
}

export class CoreOptions implements ICoreOptions {
	output: ICoreOutput = {
		location: '${tempDir}',
		filename: 'results',
		format: 'xml',
		writeJson: false,
		updateFile: 'updates.log'
	}
	quitOnEnd = true
	writeLog = false
	showErrorMessage = true
	throwError = true
	xref?: IXrefOptions

	constructor (from?: ICoreOptions) {
		if (from === undefined) {
			return
		}

		if(from.output) {
			this.output = {
				location: from.output.location ?? this.output.location,
				filename: from.output.filename ?? this.output.filename,
				format: from.output.format ?? this.output.format,
				writeJson: from.output.writeJson ?? this.output.writeJson,
				updateFile: from.output.updateFile ?? this.output.updateFile
			}
		}

		this.quitOnEnd = from.quitOnEnd ?? this.quitOnEnd
		this.writeLog = from.writeLog ?? this.writeLog
		this.showErrorMessage = from.showErrorMessage ?? this.showErrorMessage
		this.throwError = from.throwError ?? this.throwError
		this.xref = from.xref
	}
}
