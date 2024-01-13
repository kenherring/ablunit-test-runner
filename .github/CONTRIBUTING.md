# Contribution Guidelines

Thank you for your interest in contributing to this project!  All suggestions, PRs, etc are welcome.

## Code of Conduct

This project strictly enforces the [GitHub Community Code of Conduct](https://docs.github.com/en/site-policy/github-terms/github-community-code-of-conduct).  Please review it before contributing.

## Pull Requests

All pull requests must have corresponding tests and appropriate test coverage.  The CirlceCI build and SonarCloud scan generally ensure this, but PRs may still be rejected when all build steps pass if the code appears deficient in some way.

In most situations it's a good idea to create a failing test case first, and then update the code with a fix.

## Development

### Prerequisites

* Install the workspace recommended extensions
* Optional: enable the pre-commit hook: `git config core.hooksPath .git-hooks`

### Running the Project

* Run `npm install` in terminal to install dependencies
* Use the **Run Extension** target in the Debug View. This will launch a new VSCode window with the extension loaded.

### Testing the Project

Any of the following options will run the automated tests.

* `npm test`
* Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) extension and use the **Test Explorer** view
* `docker/run_tests.sh` - run all tests via docker, nearly identical to the CI/CD pipeline
  * `docker/docker_build.sh` - run once to build the container
