
export interface ICommandOptions {
	executable: string
	progressIni: string
	batch: boolean
	additionalArgs: string[]
}

export class CommandOptions implements ICommandOptions {
	executable = '_progres'
	progressIni = 'progress.ini'
	batch = true
	additionalArgs: string[] = []

	constructor (from?: ICommandOptions) {
		if (from === undefined) {
			return
		}
		this.executable = from.executable ?? this.executable
		this.progressIni = from.progressIni ?? this.progressIni
		this.batch = from.batch ?? this.batch
		this.additionalArgs = from.additionalArgs ?? this.additionalArgs
	}
}
