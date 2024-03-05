#!/bin/bash
set -eou pipefail

main_block () {
    echo "[$0 ${FUNCNAME[0]}]"
    short_tests
    long_tets

}

short_tests () {
    echo "[$0 ${FUNCNAME[0]}]"
    ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj1 npm run tes
}

long_tests () {
    echo "[$0 ${FUNCNAME[0]}]"
    npm run test
}

########## MAIN BLOCK ##########
main_block
echo "[$0] completed successfully"
