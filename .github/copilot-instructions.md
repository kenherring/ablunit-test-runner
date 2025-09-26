# AI contributor guide for ablunit-test-runner

Project overview
- A VSCode extension that discovers, runs, and reports ABLUnit tests with coverage and debugging support.
- TypeScript extension code in [src/](src), OpenEdge ABL runner in [resources/VSCodeTestRunner/](resources/VSCodeTestRunner), and comprehensive integration tests in [test/](test).
- Core flows: VSCode TestController setup → config/propath resolution → ABL process execution → parse runner output and coverage → update Test UI and coverage decorators.

Key modules and data flow
- Extension entry: [src/extension.ts](src/extension.ts) wires VSCode APIs, registers controllers, watches files, and orchestrates runs.
- Test model and parsing:
  - Test tree types and update logic in [src/testTree.ts](src/testTree.ts) (e.g., [`ABLTestProgram.updateFromContents`](src/testTree.ts)).
  - Results and coverage pipeline in [src/ABLResults.ts](src/ABLResults.ts): parses test output, builds [`DeclarationCoverage`/`StatementCoverage`], integrates debug line maps via [`ABLDebugLines`](src/ABLDebugLines.ts).
  - Source map readers: prefer rcode ([`parse/SourceMapRCodeParser.getSourceMapFromRCode`](src/parse/SourceMapRCodeParser.ts)), fallback to xref ([`parse/SourceMapXrefParser.getSourceMapFromXref`](src/parse/SourceMapXrefParser.ts)). Shared types in [src/parse/SourceMapParser.ts](src/parse/SourceMapParser.ts).
- Configuration:
  - Test profile ingestion and OpenEdge project import in [src/ABLUnitConfigWriter.ts](src/ABLUnitConfigWriter.ts) using [`getOpenEdgeProfileConfig`](src/parse/OpenedgeProjectParser.ts) and [`getProfileConfig`](src/parse/TestProfileParser.ts). Adds extension resources dir to PROPATH dynamically.
- ABL runtime:
  - Entry/stub in [resources/VSCodeTestRunner/ABLUnitCore.p](resources/VSCodeTestRunner/VSCode/ABLUnit/ABLUnitCore.p).
  - Runner in [resources/VSCodeTestRunner/VSCode/ABLUnit/Runner/ABLRunner.cls](resources/VSCodeTestRunner/VSCode/ABLUnit/Runner/ABLRunner.cls) emits lines prefixed with ABLUNIT_STATUS, serializes compiler/runtime errors to JSON, maps entity IDs, and rotates profiler files per test.

Development workflows
- Build: npm-managed with esbuild; pre-commit calls `npm run build` (see [.git-hooks/pre-commit](.git-hooks/pre-commit)).
- Tests:
  - Primary: `npm test` (drives VSCode test CLI; see [test/createTestConfig.mjs](test/createTestConfig.mjs) and [scripts/npm_pretest.sh](scripts/npm_pretest.sh)).
  - In VSCode: install “Extension Test Runner” and run suites; or run integration tests via Test Explorer.
  - In Docker/CI: [docker/run_tests.sh](docker/run_tests.sh), GitHub Actions scripts in [.github/workflows/](.github/workflows/).
- Useful test helpers: [test/testCommon.ts](test/testCommon.ts) provides `runAllTests`, `refreshTests`, `updateConfig`, `updateTestProfile`, assertions, and OpenEdge language server helpers from [test/openedgeAblCommands.ts](test/openedgeAblCommands.ts).

Conventions and patterns
- Always use [`FileUtils`](src/FileUtils.ts) for file IO (handles Uri and platform nuances).
- Log with [`ChannelLogger.log`](src/ChannelLogger.ts); tests use `log` from [test/testCommon.ts](test/testCommon.ts).
- Prefer rcode source maps. Tests often delete .xref to enforce rcode path (see [test/parse/SourceMapRCodeParser.test.ts](test/parse/SourceMapRCodeParser.test.ts)); xref parsing is a fallback and may be imperfect.
- Keep “profiler” wording consistent (see [docs/standards.md](docs/standards.md)).
- Shell scripts must use `set -euo pipefail` (pre-commit checks for this).
- Configuration docs are generated from package.json; edit descriptions in docs/configDescriptions and run [scripts/description_update.sh](scripts/description_update.sh).

Integration points
- Requires Progress OpenEdge toolchain; versions controlled by env (e.g., ABLUNIT_TEST_RUNNER_OE_VERSION). Test setup fetches ADE sources when needed (see [scripts/npm_pretest.sh](scripts/npm_pretest.sh)).
- Interacts with Riverside OpenEdge ABL LSP; tests parse its logs to detect rebuild/ready states ([test/openedgeAblCommands.ts](test/openedgeAblCommands.ts)).

Examples you can copy
- Parse rcode source map and assert mappings: see [test/parse/SourceMapRCodeParser.test.ts](test/parse/SourceMapRCodeParser.test.ts) using [`PropathParser`](src/ABLPropath.ts) and `getSourceMapFromRCode`.
- Coverage expectations and executed lines: see helpers in [test/testCommon.ts](test/testCommon.ts) around `linesExecuted` and `coverageProcessingMethod`.

Common pitfalls
- Missing rcode leads to sparse coverage and inaccurate mappings; ensure builds produce rcode before running tests.
- When adding new config keys, update JSON schema/docs and re-run description update script to keep README tables in sync.
- The ABL runner emits structured messages; any change in ABL output format must be reflected in TypeScript parsers.
