#!/bin/bash
set -euo pipefail

initialize() {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
    local VSIX_COUNT

    CIRCLECI=${CIRCLECI:-false}
    # PACKAGE_VERSION=$(node -p "require('./package.json').version")
    export DONT_PROMPT_WSL_INSTALL=No_Prompt_please

    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH="$(git branch --show-current)"
    fi

    $CIRCLECI || .circleci/package.sh

    echo "vsix files packaged:"
    find . -name 'ablunit-test-runner-*.vsix'

    VSIX_COUNT=$(find . -name 'ablunit-test-runner-*.vsix' | wc -l)
    echo "VSIX_COUNT=$VSIX_COUNT"
}

build_dummy_extension() {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    cd dummy-ext
    npm install
    npm run compile
}

compile_install_run() {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

    if [ -n "${DOCKER_IMAGE:-}" ]; then
        ## docker and pipeline
        xvfb-run -a npm run test:install-and-run
    else
        ## local
        npm run test:install-and-run
    fi
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] test run successful"
}

########## MAIN BLOCK ##########
initialize
build_dummy_extension
compile_install_run
echo "[$0] completed successfully!"
