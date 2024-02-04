// This has been adopted from the proposed API for test coverage in VSCode
// It's just a skeleton used by this extension as a holdover until the API is finalized

import { DecorationOptions, Position, Range, Uri } from 'vscode'

export interface IExecLines {
	count?: number,
	lines?: DecorationOptions[]
	executed?: DecorationOptions[]
	executable?: DecorationOptions[]
}

export class CoveredCountCustom {
	covered: number // Number of items covered in the file.
	total: number // Total number of covered items in the file.

	constructor (covered: number, total: number) {
		this.covered = covered
		this.total = total
	}
}

export type DetailedCoverageCustom = StatementCoverageCustom | BranchCoverageCustom

export class FileCoverageCustom {
	readonly uri: Uri
	statementCoverage: CoveredCountCustom
	detailedCoverage: StatementCoverageCustom[] = []

	constructor (uri: Uri, statementCoverage: CoveredCountCustom) {
		this.uri = uri
		this.statementCoverage = statementCoverage
		this.detailedCoverage = []
	}
}

export class StatementCoverageCustom {
	executionCount: number
	executed = false
	location: Position | Range

	constructor (executionCount: number, location: Position | Range) {
		this.executionCount = executionCount
		this.location = location
	}
}

export class BranchCoverageCustom {
	executionCount: number
	executed = false
	location: Position | Range

	constructor (executionCount: number, location: Position | Range) {
		this.executionCount = executionCount
		this.location = location
	}
}
