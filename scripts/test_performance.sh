#!/bin/bash
set -eou pipefail

## This script runs a test without and with coverage to compare timing.
## Use this when testing the performance of a test suite to ensure we're
## completing the build in a timely manner.

main_block () {
    export ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj0
    time npm_test
    time npm_coverage
    time npm_test_docker
    time npm_coverage_docker
}

function npm_test () {
    # npm test >/dev/null
    # npm test 2>/dev/null
    # npm test >/dev/null 2>&1
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    npm test > artifacts/perf_npm_test.log 2>&1
}

function npm_test_docker () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    docker/run_tests.sh -n > artifacts/perf_npm_test_docker.log 2>&1
}

function npm_coverage () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    # npm test -- --coverage > artifacts/perf_npm_coverage.log 2>&1
    npm run test:coverage > artifacts/perf_npm_coverage.log 2>&1
}

function npm_coverage_docker () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    docker/run_tests.sh > artifacts/perf_npm_coverage_docker.log 2>&1
}

########## MAIN BLOCK ##########
main_block
