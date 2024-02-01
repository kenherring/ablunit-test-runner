
interface ICoreOutput {
	location?: string
	filename?: string
	format?: 'xml'
	writeJson: boolean
}

export interface ICoreOptions {
	output?: {
		location?: string
		filename?: string
		format?: 'xml'
		writeJson: boolean
	}
	quitOnEnd?: boolean // = true
	writeLog?: boolean // = true
	showErrorMessage?: boolean // = true
	throwError?: boolean // = true
}

export class CoreOptions implements ICoreOptions {
	output: ICoreOutput = {
		location: '${tempDir}',
		filename: 'results',
		format: 'xml',
		writeJson: false
	}
	quitOnEnd = true
	writeLog = false
	showErrorMessage = true
	throwError = true

	constructor (from?: ICoreOptions) {
		if (from === undefined) {
			return
		}

		if(from.output) {
			this.output = {
				location: from.output.location ?? this.output.location,
				filename: from.output.filename ?? this.output.filename,
				format: from.output.format ?? this.output.format,
				writeJson: from.output.writeJson ?? this.output.writeJson
			}
		}

		this.quitOnEnd = from.quitOnEnd ?? this.quitOnEnd
		this.writeLog = from.writeLog ?? this.writeLog
		this.showErrorMessage = from.showErrorMessage ?? this.showErrorMessage
		this.throwError = from.throwError ?? this.throwError
	}
}
