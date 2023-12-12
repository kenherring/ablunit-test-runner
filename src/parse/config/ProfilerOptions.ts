
export interface IProfilerOptions {
	enabled?: boolean //= true
	coverage?: boolean //= true
	description?: string //= "Run via VSCode - ABLUnit Test Provider Extension"
	filename?: string //= "prof.out"
	listings?: string //= ""
	statistics?: boolean //= false
	traceFilter?: string //= ""
	tracing?: string //= ""
	writeJson?: boolean //= false
}

export class ProfilerOptions implements IProfilerOptions {
	public enabled: boolean = true
	public coverage: boolean = true
	public description: string = 'Run via VSCode - ABLUnit Test Provider Extension'
	public filename: string = 'prof.out'
	public listings: string = ''
	public statistics: boolean = false
	public traceFilter: string = ''
	public tracing: string = ''
	public writeJson: boolean = false

	merge (from?: IProfilerOptions) {
		if (from === undefined) {
			return this
		}
		this.enabled = from.enabled ?? this.enabled
		this.coverage = from.coverage ?? this.coverage
		this.description = from.description ?? this.description
		this.filename = from.filename ?? this.filename
		this.listings = from.listings ?? this.listings
		this.statistics = from.statistics ?? this.statistics
		this.traceFilter = from.traceFilter ?? this.traceFilter
		this.tracing = from.tracing ?? this.tracing
		this.writeJson = from.writeJson ?? this.writeJson
	}
}
