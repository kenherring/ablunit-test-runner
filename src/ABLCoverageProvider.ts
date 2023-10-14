import { CancellationToken, CoveredCount, FileCoverage, Location, Position, ProviderResult, Range, StatementCoverage, TestCoverageProvider, Uri } from "vscode";


export class ABLCoverageProvider implements TestCoverageProvider {

    constructor () {
        console.log("ABLCoverageProvider constructor")
        // count: CoveredCount = new CoveredCount(1,1)
    }

    provideFileCoverage(token: CancellationToken): ProviderResult<FileCoverage[]> {
        console.log("ABLCoverageProvider profideFileCoverage")
        const coverage: FileCoverage[] = []
        const fileUri: Uri = Uri.parse("C:\git\ablunit-test-provider\test_projects\proj1\classTest.cls")

        // const pos: Position = new Position(1,1)
        // const stmt: StatementCoverage = new StatementCoverage(1, new Range(pos,pos))

        const cov: CoveredCount = new CoveredCount(1,2)
        coverage[0] = new FileCoverage(fileUri, cov)
        return coverage
    }

    resolveFileCoverage(coverage: FileCoverage, token: CancellationToken): ProviderResult<FileCoverage> {
        console.log("ABLCoverageProvider resolveFileCoverage")
        return coverage
    }

}