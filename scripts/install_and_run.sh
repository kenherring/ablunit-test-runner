#!/bin/bash
set -euo pipefail

initialize() {
    echo "[$0 ${FUNCNAME[0]}]"
    rm -f ./*.vsix
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH="$(git branch --show-current)"
    fi

    export DONT_PROMPT_WSL_INSTALL=No_Prompt_please
}

build_extension() {
    echo "[$0 ${FUNCNAME[0]}]"
    if ! $CIRCLECI; then
        npm install
        vsce package --pre-release --githubBranch "$CIRCLE_BRANCH"
    fi
    cd dummy-ext
    npm run compile
}

compile_install_run() {
    echo "[$0 ${FUNCNAME[0]}]"

    if [ -n "${DOCKER_IMAGE:-}" ]; then
        ## docker and pipeline
        xvfb-run -a npm run test:install-and-run
    else
        ## local
        npm run test:install-and-run
    fi
    echo "[$0 ${FUNCNAME[0]}] test run successful"
}

########## MAIN BLOCK ##########
initialize
build_extension
compile_install_run
echo "[$0] completed successfully!"
