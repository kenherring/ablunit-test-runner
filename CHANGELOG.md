# [1.4.4](https://github.com/kenherring/ablunit-test-runner/releases/tag/1.4.4) - 2025-11-26 (pre-release)

* Prepare 1.4.4 (+#454)
* Add `initializationProcedure` option to ablunit-test-profile.json (#453)
* Bump typescript-eslint from 8.46.4 to 8.48.0 (#449)
* Bump @vscode/vsce from 3.7.0 to 3.7.1 (#450)
* Bump glob from 10.3.10 to 10.5.0 in /dummy-ext in the npm_and_yarn group across 1 directory (#447)
* Bump @types/node from 24.10.0 to 24.10.1 (#443)
* Bump the npm_and_yarn group across 1 directory with 1 update (#446)
* Bump js-yaml from 3.14.1 to 3.14.2 in the npm_and_yarn group across 1 directory (#445)

**Full Changelog**: [1.4.0...1.4.4](https://github.com/kenherring/ablunit-test-runner/compare/1.4.1...1.4.4)

# [1.4.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/1.4.0) - 2025-11-12

* Prepare version 1.4.0 (#370, #438, #425)
* Improve DLC identification (#440, #441)
* Minor updates from WSL testing (#431)
* require vscode engine 1.96.0+ (#422)
* Add configuration options for disabling competion items (#413)
* Set branch name in CI run for main branch (#412)
* Unit test configuration update (#403)
* Use vscode-abl extension exports to restart language server in extension tests (#397)
* Skip SonarQube for dependabot workflows (#401)
* Switch to GitHub Actions build runner (#398, #414, #415, #423, #432)
* Add back missing configuration json in package (#385)
* Add `.vscode/mcp.json` and regenerate `.github/copilot-instructions.md` (#383)
* Reduce duplication in detected source maps (#377)
* Add OpenEdge 12.8.9 test target (#339, #371, #376)
* Adhere to include/exclude patterns in openedge-project.json (#334)
* Fix propath calculations for classes with `.` in the filepath (#338)
* Add "in the news" to README.md links (#333)
* Improve debug listing line calculations (#327)
* Improve test results for failures due to DB connection issues (#307)
* Add extension resources directory to propath at runtime (#316)
* Add Debug Listing Preview (#305, #317, #318, #320)
* Fix reported code coverage (#314)
* Dependencies
* Bump @eslint/js from 9.27.0 to 9.38.0 (#311, #342, #346, #368, #387, #405, #417)
* Bump @stylistic/eslint-plugin-ts from 4.2.0 to 4.4.0 (#303)
* Bump @types/node from 22.15.17 to 22.15.30 (#304, #312, #321)
* Bump @types/node from 24.0.0 to 24.10.0 (#328, #349, #355, #343, #344, #361, #366, #406, #409, #416, #433)
* Bump @types/vscode from 1.100.0 to 1.104.0 (#330, #348, #372, #439)
* Bump @vscode/vsce from 3.4.1 to 3.7.0 (#302, #323, #340, #407, #434)
* Bump brace-expansion from 1.1.11 to 1.1.12 in the npm_and_yarn group (#326)
* Bump esbuild from 0.25.4 to 0.27.0 (#325, #351, #354, #375, #396, #420, #428, #435)
* Bump eslint from 9.27.0 to 9.39.0 (#308, #332, #341, #347, #352, #358, #367, #382, #388, #411, #418, #430)
* Bump form-data from 4.0.1 to 4.0.4 in the npm_and_yarn group (#353)
* Bump minimatch from 10.0.1 to 10.1.1 (#331, #429)
* Bump mocha from 11.4.0 to 11.7.5 (#301, #324, #337, #384, #437)
* Bump PCT from v229 to v230 (#424)
* Bump tar-fs from 2.1.2 to 2.1.4 (#313, #399)
* Bump tmp from 0.2.3 to 0.2.5 (#364)
* Bump typescript from 5.8.3 to 5.9.3 (#363, #410)
* Bump typescript-eslint from 8.32.1 to 8.46.4 (#310, #322, #336, #345, #357, #362, #365, #380, #389, #400, #419, #427, #436)
* Bump version to 1.3.39 (#360)

**Full Changelog**: [1.3.0...1.4.0](https://github.com/kenherring/ablunit-test-runner/compare/1.3.85...1.4.0)

# [1.3.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/1.3.0) - 2025-05-21

* Prefer COPY over ADD for copying local resources (#298)
* Do not bump version for dependabot PRs (#299)
* Update dependencies - mocha, eslint, typescript-eslint, eslint-plugin, vsce (#297)
* Display warning for missing `[BLOCK|ROUTINE]-LEVEL ON ERROR` statement (#290)
* Update changelog updater (#291)
* Remove creation of `.bin` files (#289)
* Add OpenEdge 12.8.7 test target (#287)
* Bump mocha from 11.1.0 to 11.2.2 (#286)
* Warn when rcode CRC does not match profiler CRC (#272)
* Bump dependencies (#285)
* Create codeql.yml (#278)
* Create dependabot.yml (#275)
* Bump the npm_and_yarn group across 1 directory with 2 updates (#277)
* Update eslint configuration (#279)
* Unit test cleanup and performance (#274)
* Bump braces from 3.0.2 to 3.0.3 in /dummy-ext in the npm_and_yarn group across 1 directory (#276)
* Increase debug profile wait time to 30s (part 2) (#273)

**Full Changelog**: [1.2.0...1.3.0](https://github.com/kenherring/ablunit-test-runner/compare/1.2.0...1.3.0)

# [1.2.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/1.2.0) - 2025-04-26

* Bump version to 1.2.0 for release (#271)
* Don't display destructors as overloaded constructors (#252)
* Add test case for capturing declaration header in the declaration range (#254)
* Add `debugConnectMaxWait` to test profile configuration options (#266)
* Exception call stacks (#263)
* Improve parsing and display of test output (#262)
* Exception call stacks (#263)
* Improve parsing and display of test output (#262)
* Coverage by test case declarations (#255)
* Enable debuging TestRunProfile (#257)
* Update output for messages from tests (#260)

**Full Changelog**: [1.1.0...1.2.0](https://github.com/kenherring/ablunit-test-runner/compare/1.1.0...1.2.0)

# [1.1.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/1.1.0) - 2025-02-16

## Release Notes

This release significantly improves the coverage reporting and leverages the native VSCode API to provide coverage attribution by test case.

* Suggest enabling `testing.coverageToolbarEnabled` in your VSCode settings to get the full effect of the improved coverage reporting.
* This release is more heavily dependent on rcode parsing for source mapping.
* If for whatever reason you do not have rcode available for your tests you can enable the `coverage` option in `.vscode/ablunit-test-profile.json` to parse from the profiler output.
* Backup xref parsing still exists but will likely be deprecated.

## Change Summary

* Line execution counts, improved ranges, and fix individual test coverage (#246)
* Add OpenEdge 12.8.6 test target (#247)
* Ungroup overloaded methods for coverage reporting (#245)
* Target multiple versions of node when running tests (#243)
* Add test cases to validate source map parsing source (#239)
* Add profiler options `perTest` and `ignoreExternalCoverage` for improved parsing performance (#238)
* Replace snippets with CompletionItemProvider for better granularity (#237)
* Profile parsing performance improvement for multiple data files (#235)
* improve messages for compile errors (#233)
* Test coverage attribution (#228)
* Refactor file access functions (#229)
* [chore] npm update (#226)
* Call stack parsing: support multiple errors per test case and negative line numbers for implicit constructors (#223)

## Known Bugs

* Destructors appear as overloaded constructors in the coverage reporting.
* Fallback to xref parsing gives disjoint source mapping. This will probably be deprecated.

**Full Changelog**: [1.0.0...1.0.6028](https://github.com/kenherring/ablunit-test-runner/compare/1.0.0...1.0.6028)

# 🥳 [1.0.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/1.0.0) - 2024-10-24

* Finally, a non-preview release!
* Various fixes and updates
* Improved test run output, including call stacks with test failure messages

**Full Changelog**: [0.2.0...1.0.0](https://github.com/kenherring/ablunit-test-runner/compare/0.2.17...1.0.0)

<!--
# [0.2.17](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.17) - 2024-10-14 (pre-release)

* add `timeout` key to test config (#217)
* Unskip tests and ensure they pass (#216)
* Read `openedge-project.json` profile by name consistently (#212)

**Full Changelog**: [0.2.15...0.2.17](https://github.com/kenherring/ablunit-test-runner/compare/0.2.15...0.2.17)

# [0.2.15](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.15) - 2024-10-08 (pre-release)

* Use `TestMesssage.stackTrace` instead of custom display (#213)
* Minor script and test cleanup (#178)

**Full Changelog**: [0.2.13...0.2.15](https://github.com/kenherring/ablunit-test-runner/compare/0.2.13...0.2.15)

# [0.2.13](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.13) - 2024-10-03 (pre-release)

* Unskip proj7 tests for large projects (#194)

**Full Changelog**: [0.2.11...0.2.13](https://github.com/kenherring/ablunit-test-runner/compare/0.2.11...0.2.13)

# [0.2.11](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.11) - 2024-09-30 (pre-release)

* Upload artifact to gh release automatically (#209)
* Restore watcher for file create, update, delete (#207)
* Add snippets for the  `@BeforeAll`,  `@BeforeEach`,  `@AfterEach`, `@AfrerAll` annotations (#205)
* Use vsce as a development dependency instead of globally installing (#206)

**Full Changelog**: [0.2.7...0.2.11](https://github.com/kenherring/ablunit-test-runner/compare/0.2.7...0.2.11)

# [0.2.7](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.7) - 2024-09-24 (pre-release)

This is a release candidate for 1.0.0.  There is one open PR ([#194](https://github.com/kenherring/ablunit-test-runner/pull/194)), but if there are other issues reported they may be addressed as well.

* Show incremental test results during test run (#195)
* Chore: fix emoji use in issue templates (#197)
* Add OE 12.8.4 test target (#196)
* Fix coverage reporting on first line and line after executed line (#193)
* Improve test name parsing when using `#` character (#190)
* npm update (#192)
* Add xref options to test profile configuration (#191)
* Use `charset` and `extraParameters` from `openedge-project.json` (#189)
* Replace `${DLC}` in executed command and generated ini file (#188)

**Full Changelog**: [0.2.5...0.2.7](https://github.com/kenherring/ablunit-test-runner/compare/0.2.5...0.2.7)

# [0.2.5](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.5) - 2024-09-03 (pre-release)

* Update test parsing to find skipped/ignored tests (#184)
* Parse test methods using expected error annotation (#183)
* Unskip and fix tests (#182)
* Switch compile back to eslint (#180)
* Update eslint rules and related fixes (#179)
* Sonar coverage reporting - part 1 (#177)

**Full Changelog**: [0.2.3...0.2.5](https://github.com/kenherring/ablunit-test-runner/compare/0.2.3...0.2.5)

# [0.2.3](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.3) - 2024-08-06 (pre-release)

* Re-enable test cases (#172)
* Mocha reporters and sonar test results (#174)
* Add OE 12.8.3 as a test target (#173)
* Error configuration for scripts (#170)
* Update tests to use suiteSetupCommon (#169)
* Implement coverage via the official TestCoverage API (#155)
* Mocha reporter config for script runs vs vscode runs (#168)
* update issue templates 3 (#167)
* Update issue templates - round 2 (#166)
* Update issue templates (#165)
* Add timestamps to echo (#164)
* Eslint: update rules for promises and style (#158)
* update package.json dependencies (#160)
* Bump vscode to 1.88 (#154)
* Bump @vscode/test-cli to 0.0.9, eslint to 7.5.0 (#153)
* 🧹 Add issue templates (#145)
* Add OE 12.8.1 build target (#150)
* npm update (bump versions) (#149)
* bump PCT to v228 (#151)
* Move `src/test` to `test` (#148)
* Various development related updates (#147)
* Minor configuration updates and consistency improvements (#146)
* Update deps; upload vsix to github release; prep release v0.2.2 (#141)
* Build an insiders package that leverages the VSCode proposed TestCoverage proposed API (#138)
* Sync for consistency when rebasing insiders (#136)
* Remove configuration `ablunit.notificationsEnabled` - use 'Do not disturb mode by source command' (#131)
* Rename configuration `discoverFilesOnActivate` to `discoverAllTestsOnActivate` (#132)

See also: [Known issues in pre-release 0.2.3 (#175)](https://github.com/kenherring/ablunit-test-runner/issues/175)

**Full Changelog**: [0.2.1...0.2.3](https://github.com/kenherring/ablunit-test-runner/compare/0.2.1...0.2.3)

# [0.2.1](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.1) - 2024-02-02 (pre-release)

* Stop refresh/test run - improving process abort (#129)
* Decorator: stop runaway events; add unit tests (#126)

**Full Changelog**: [0.2.0...0.2.1](https://github.com/kenherring/ablunit-test-runner/compare/0.2.0...0.2.1)

-->

# 🥇 [0.2.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.0) - 2024-01-22

Initial release to marketplace

<!--
# [0.1.22](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.1.22) - 2024-01-21 (pre-release)

* Various pipeline, versioning, and release updates
* Ensure timely response when cancelling a test run (#103)
* Set path environment var to test run with `terminal.integrated.env` settings (#97)
* Pass `terminal.integrated.env` configuation to ABLUnit process (#91)
* Rename repo: replace 'ablunit-test-runner' references with 'ablunit-test-runner' (#96)
* Rework snippets to remove language competition (#95)
* Write progress.ini to the proper location (#94)
* Call stack show line number instead of uri (#93)
* Allow tests to run with no ablunit-test-profile.json file (#92)
* Update `workspaceDir` -> `workspaceFolder` (#88)

**Full Changelog**: [v0.1.9...v0.1.22](https://github.com/kenherring/ablunit-test-runner/compare/v0.1.9...v0.1.22)

# [v0.1.9](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.9) - 2024-01-05 (pre-release)

* Import DB connections from openedge-project.json
* Parse source map from rcode for accuracy
* Load run profiles from `.vscode/ablunit-test-profile.json`
* Enable custom CLI commands such as `ant test`
* Various fixes/improvements/linting

# [v0.1.7](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.7) - 2023-12-06 (pre-release)

* Refactoring
* WSL fixes for extension development
* Fix json parsing `openedge-project.json` when comments are present
* Fix usage of dot-dir in `ablunit` configuration

# [v0.1.6](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.6) - 2023-11-30 (pre-release)

* Performance improvements
* Test suite parsing enabled
* Various fixes for testing config (absolute paths, DLC lookup)

# [v0.1.4](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.4) - 2023-11-24 (pre-release)

* Fix badges displayed in marketplace
* Cleanup configuration options

# [v0.1.3](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.3) - 2023-11-24 (pre-release)

* Fix badges displayed in marketplace

# [v0.1.2](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.2) - 2023-11-23 (pre-release)

* Various improvements/fixes

# [v0.1.1](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.1) - 2023-11-14 (pre-release)

* Improve coverage analysis
* Fix and add test for `ablunit.params`

# [v0.1.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.1.0) - 2023-11-09 (pre-release)

* Flatten the VSCode `ablunit` configuration options
* Adding test cases for `ablunit.tempDir` with fixes
* Increate test coverage and improve reporting consistency

# [v0.0.1](https://github.com/kenherring/ablunit-test-runner/releases/tag/v0.0.1) - 2023-11-05 (pre-release)

Initial pre-release to marketplace
-->
