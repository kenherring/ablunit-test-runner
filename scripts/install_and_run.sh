#!/bin/bash
set -euo pipefail

initialize() {
    rm -f ./*.vsix
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH="$(git branch --show-current)"
    fi
}

build_extension() {
    npm install
    vsce package --pre-release --githubBranch "$CIRCLE_BRANCH"
}

compile_install_run() {
    cd dummy-ext
    npm run compile
    npm run test:install-and-run
}

########## MAIN BLOCK ##########
initialize
build_extension
compile_install_run
echo "install_and_run.sh completed successfully!"
