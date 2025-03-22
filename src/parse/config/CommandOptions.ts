
export interface ICommandOptions {
	executable: string | undefined
	progressIni: string | undefined
	batch: boolean | undefined
	debugHost: string | undefined
	debugPort: number | undefined
	additionalArgs: string[] | undefined
}

export class CommandOptions implements ICommandOptions {
	executable = '_progres'
	progressIni = 'progress.ini'
	batch = true
	debugHost = 'localhost'
	debugPort = 3199
	additionalArgs: string[] = []

	constructor (from?: ICommandOptions) {
		if (from === undefined) {
			return
		}
		this.executable = from.executable ?? this.executable
		this.progressIni = from.progressIni ?? this.progressIni
		this.batch = from.batch ?? this.batch
		this.debugHost = from.debugHost ?? this.debugHost
		this.debugPort = from.debugPort ?? this.debugPort
		this.additionalArgs = from.additionalArgs ?? this.additionalArgs
	}
}
