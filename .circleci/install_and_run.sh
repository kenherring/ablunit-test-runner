#!/bin/bash
set -euo pipefail

initialize() {
    echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
    local VSIX_COUNT

    CIRCLECI=${CIRCLECI:-false}
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    export DONT_PROMPT_WSL_INSTALL=No_Prompt_please

    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH="$(git branch --show-current)"
    fi

    $CIRCLECI || create_package

    echo "vsix files packaged:"
    find . -name 'ablunit-test-runner-*.vsix'

    VSIX_COUNT=$(find . -name 'ablunit-test-runner-*.vsix' | wc -l)
    echo "VSIX_COUNT=$VSIX_COUNT"
    if [ "$VSIX_COUNT" != "1" ] && [ "$VSIX_COUNT" != 2 ] && [ "$VSIX_COUNT" != 3 ]; then
        echo "ERROR: expected three vsix files, found $VSIX_COUNT" >&2
        if [ "$VSIX_COUNT" = "0" ]; then
            echo "No vsix files found. file listing:" >&2
            ls -al >&2
        else
            echo "*.vsix files found:" >&2
            find . -name 'ablunit-test-runner-*.vsix' >&2
        fi
        exit 1
    fi
    if [ ! -f "./ablunit-test-runner-$PACKAGE_VERSION.vsix" ]; then
        echo "ERROR: expected vsix file with name 'ablunit-test-runner-$PACKAGE_VERSION.vsix'" >&2
        exit 1
    fi
}

create_package () {
    local VSIX_COUNT
    VSIX_COUNT=$(find . -name 'ablunit-test-runner-*.vsix' | wc -l)
    echo "VSIX_COUNT=$VSIX_COUNT"
    if  [ "$VSIX_COUNT" = "0" ]; then
        npm install
        vsce package --pre-release --githubBranch "$CIRCLE_BRANCH"
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
