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

# [0.2.0](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.2.0) - 2024-01-22

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
