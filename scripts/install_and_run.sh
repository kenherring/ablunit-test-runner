#!/bin/bash
set -euo pipefail

initialize() {
    echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
    cd /home/circleci/project
    echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"

    CIRCLECI=${CIRCLECI:-false}
    PACKAGE_VERSION=$(node -p "require('./package.json').version")

    rm -f ./*.vsix
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH="$(git branch --show-current)"
    fi

    export DONT_PROMPT_WSL_INSTALL=No_Prompt_please
    if ! $CIRCLECI; then
        npm install
        vsce package --pre-release --githubBranch "$CIRCLE_BRANCH"
    fi

    local VSIX_COUNT
    VSIX_COUNT=$(find . -name 'ablunit-test-runner-*.vsix' | wc -l)
    if [ "$VSIX_COUNT" != "1" ]; then
        echo "ERROR: expected 1 vsix file, found $VSIX_COUNT" >&2
        if [ "$VSIX_COUNT" != "0" ]; then
            echo "*.vsix files found:" >&2
            find . -name 'ablunit-test-runner-*.vsix' >&2
        fi
        exit 1
    fi
    if [ ! -f "./ablunit-test-runner-$PACKAGE_VERSION.vsix" ]; then
        echo "ERROR: expected vsix file to be named 'ablunit-test-runner-$PACKAGE_VERSION.vsix'" >&2
        exit 1
    fi
}

build_dummy_extension() {
    echo "[$0 ${FUNCNAME[0]}]"
    cd dummy-ext
    npm install
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
build_dummy_extension
compile_install_run
echo "[$0] completed successfully!"
