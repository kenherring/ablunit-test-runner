#!/bin/bash
set -eou pipefail


project_test_run () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
    PROJECT_NAME=proj1 npm test
    ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj1 npm test
    ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj1 npm run test
    ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj1 docker/run_tests.sh
    npm test -p proj1
    docker/run_tests.sh -p proj1
}

full_test_run () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
    npm test

    docker/run_tests.sh
    docker/run_tests.sh -V insiders
    docker/run_tests.sh -o 12.7
    docker/run_tests.sh -o 12.7 -V insiders
    docker/run_tests.sh -n

    docker/run_tests.sh -i

    vscode-test
}
