
export interface ICommandOptions {
	executable: string | undefined
	progressIni: string | undefined
	batch: boolean | undefined
	debugHost: string | undefined
	debugPort: number | undefined
	debugConnectMaxWait: number | undefined
	additionalArgs: string[] | undefined
}

export class CommandOptions implements ICommandOptions {
	executable = '_progres'
	progressIni = 'progress.ini'
	batch = true
	debugHost = 'localhost'
	debugPort = 3199
	debugConnectMaxWait = 10000
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
		this.debugConnectMaxWait = from.debugConnectMaxWait ?? this.debugConnectMaxWait
		this.additionalArgs = from.additionalArgs ?? this.additionalArgs
	}
}
