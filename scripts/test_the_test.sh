#!/bin/bash
set -euo pipefail

usage () {
	echo "
usage: $0 [ -p <project_name> ] [-bBimPv]
options:
  -p <project>  run tests for a specific test project (default: DebugLines)
                alternative: set the  ABLUNIT_TEST_RUNNER_PROJECT_NAME environment variable
  -v            verbose
  -h            show this help message and exit
" >&2
}

function initialize () {
    echo "[${FUNCNAME[0]}] Initializing..."
    VERBOSE=false
    RUN_COMMAND_COUNT=0
    ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-DebugLines}
    ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-stable}

    while getopts "bBCdimnso:p:PvV:h" OPT; do
		case $OPT in
			p)	ABLUNIT_TEST_RUNNER_PROJECT_NAME=$OPTARG ;;
			v)	VERBOSE=true ;;
			?)	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done
    export ABLUNIT_TEST_RUNNER_PROJECT_NAME
    export VERBOSE
}

function main_block () {
    echo "[${FUNCNAME[0]}] Running main block..."

    ## local commands
    run_command npm test
    # run_command npm run test:coverage

    ## docker commands
    # run_command docker/run_tests.sh -d -m
    run_command docker/run_tests.sh -d -m -V insiders
    # run_command docker/run_tests.sh -d -m -o 12.7.0
    # run_command docker/run_tests.sh -d -m -o 12.7.0 -V insiders
}

function run_command () {
    RUN_COMMAND_COUNT=$((RUN_COMMAND_COUNT+1))
    COMMAND=("$@")
    echo "Running command: '${COMMAND[*]}'"
    if ! "${COMMAND[@]}"; then
        echo "Command failed! '${COMMAND[*]}'"
        exit 1
    fi
}

########## MAIN BLOCK ##########
initialize "$@"
main_block
echo "all command mutations successful! (RUN_COMMAND_COUNT=$RUN_COMMAND_COUNT)"
