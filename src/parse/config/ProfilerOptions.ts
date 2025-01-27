
export interface IProfilerOptions {
	enabled?: boolean
	coverage?: boolean
	description?: string
	filename?: string
	listings?: string | boolean
	statistics?: boolean
	traceFilter?: string
	tracing?: boolean
	writeJson?: boolean
	perTest?: boolean
	ignoreExternalCoverage?: boolean
}

export class ProfilerOptions implements IProfilerOptions {
	public enabled = true
	public coverage = true
	public description = 'Run via VSCode - ABLUnit Test Runner Extension'
	public filename = 'prof.out'
	public listings: string | boolean = false
	public statistics = false
	public traceFilter = ''
	public tracing = false
	public writeJson = false
	public perTest = true
	public ignoreExternalCoverage = true

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
		this.perTest = from.perTest ?? this.perTest
		this.ignoreExternalCoverage = from.ignoreExternalCoverage ?? this.ignoreExternalCoverage
	}
}
