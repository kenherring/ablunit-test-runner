# Contribution Guidelines

Thank you for your interest in contributing to this project!  All suggestions, PRs, etc are welcome.

## Code of Conduct

This project strictly enforces the [GitHub Community Code of Conduct](https://docs.github.com/en/site-policy/github-terms/github-community-code-of-conduct).  Please review it before contributing.

Additional guidelines may be added to this document as neccessary.

## Pull Requests

All pull requests must have corresponding tests and appropriate test coverage.  The CirlceCI build and SonarCloud scan do a good job of ensuring this, but PRs may still be rejected when all build steps pass if the code appears deficient in some way.

## Development

### Prerequisites

* Install the workspace recommended extensions
* Enable the git pre-commit hook: `git config core.hooksPath .git-hooks`

### Running the Project

- Run `npm install` in terminal to install dependencies
- Run the `Run Extension` target in the Debug View. This will:
	- Start a task `npm: watch` to compile the code
	- Run the extension in a new VS Code window
- Run a test in the new VS Code window

### Testing the Project

* Using the CLI: `npm test`
* Using the native VSCode API: install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) extension
* Using docker:
    ```bash
	docker/docker_build.sh # run once to build the container
	docker/run_tests.sh # run each time you want the tests to execute
	```
