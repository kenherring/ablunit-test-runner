#!/bin/bash
set -euo pipefail

main_block () {
    echo "[$0 ${FUNCNAME[0]}]"

    if ! $CIRCLECI; then
        [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=$(git branch --show-current)
        [ -z "${CIRCLE_TAG:-}" ] && CIRCLE_TAG=$(git describe --tags --abbrev=0)
    fi

    if [ -z "${CIRCLE_TAG:-}" ]; then
        echo "ERROR: missing CIRCLE_TAG environment var"
        exit 1
    fi

    if [ ! -f "ablunit-test-runner-${CIRCLE_TAG}.vsix" ]; then
        echo "ERROR: ablunit-test-runner-${CIRCLE_TAG}.vsix not found, creating it now..."
        exit 1
    fi

    npm install -g @vscode/vsce || sudo npm install -g @vscode/vsce
    vsce publish --pre-release --githubBranch "main" --packagePath "ablunit-test-runner-${CIRCLE_TAG}.vsix"
}

attach_to_github_release () {
    echo "[$0 ${FUNCNAME[0]}] TODO - not yet implemented"
}

########## MAIN BLOCK ##########
main_block
attach_to_github_release
echo "[$0] completed successfully"
