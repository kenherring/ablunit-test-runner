# Testing

## Test the Extension

* `npm test` - run unit tests
* `docker/run_tests.sh` - run unit tests within a docker container
  * This is the same way that CircleCI run the tests

### VSCode Test Runner

All tests can be run in the VSCode UI via the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner).

## Install and Run

This is a smoke test that confirms the packaged extension is functional.  This runs twice - once with the current version of VSCode and once with the insiders version.  If the insiders run fails it indicates we might have a problem with the next release of VSCode.

```
cd dummy-ext
npm run compile
npm run test:install-and-run
```

## Dev Tooling

The following tooling is configured for development in this repo.

* [typescript-eslint](https://typescript-eslint.io/)
