# [0.1.19](https://github.com/kenherring/ablunit-test-runner/releases/tag/0.1.19) - 2024-01-21 (pre-release)

 * Various pipeline, versioning, and release updates
 * Ensure timely response when cancelling a test run (#103)
 * Set path environment var to test run with `terminal.integrated.env` settings (#97)
 * Pass `terminal.integrated.env` configuation to ABLUnit process (#91)
 * Rename repo: replace 'ablunit-test-provider' references with 'ablunit-test-runner' (#96)
 * Rework snippets to remove language competition (#95)
 * Write progress.ini to the proper location (#94)
 * Call stack show line number instead of uri (#93)
 * Allow tests to run with no ablunit-test-profile.json file (#92)
 * Update `workspaceDir` -> `workspaceFolder` (#88)

**Full Changelog**: [v0.1.9...v0.1.19](https://github.com/kenherring/ablunit-test-runner/compare/v0.1.9...v0.1.19)

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
