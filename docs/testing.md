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

* [esbuild](https://esbuild.github.io/)
* [eslint](https://typescript-eslint.io/)
* [mocha](https://mochajs.org/) and [nyc](https://github.com/istanbuljs/nyc)
* VSCode [test-cli](https://github.com/microsoft/vscode-test-cli) and [Extension Test Runner](https://github.com/microsoft/vscode-extension-test-runner)

<!--
## Commands that should always pass
docker/docker-build.sh
docker/run_tests.sh
docker/run_tests.sh -i
docker/run_tests.sh -d
docker/run_tests.sh -o 12.2
docker/run_tests.sh -o 12.2 -i
docker/run_tests.sh -o 12.2 -d
docker/run_tests.sh -P

## Test Files

* `runTest.ts`
  * `src/test/runTest.ts`
* `index.ts`

-->

## Testing Methodology

The follow can be used to execute the test suites.

* [VSCode Extension Test Runner](https://github.com/istanbuljs/nyc)
* `npm test`
* `npm vscode-test`
* `docker/run_tests.sh`
