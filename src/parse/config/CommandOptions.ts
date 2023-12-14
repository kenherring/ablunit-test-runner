
export interface ICommandOptions {
	executable: string
	progressIni: string
	batch: boolean
	additionalArgs: string[]
}

export class CommandOptions implements ICommandOptions {
	executable: string = "_progres"
	progressIni: string = "progress.ini"
	batch: boolean = true
	additionalArgs: string[] = []

	constructor(from?: ICommandOptions) {
		if (from === undefined) {
			return
		}
		this.executable = from.executable ?? this.executable
		this.progressIni = from.progressIni ?? this.progressIni
		this.batch = from.batch ?? this.batch
		this.additionalArgs = from.additionalArgs ?? this.additionalArgs
	}
}
