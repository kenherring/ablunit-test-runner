#!/bin/bash
set -euo pipefail

main_block () {
    echo "[$0 ${FUNCNAME[0]}]"

    if ! $CIRCLECI && [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH=$(git branch --show-current)
    fi
    ## CIRCLE_TAG=$(git describe --tags --abbrev=0)

    if [ -z "$CIRCLE_TAG" ]; then
        echo "exit: CIRCLE_TAG is empty, cannot publish release..."
        exit 1
    fi
    if [ ! -f "ablunit-test-runner-${CIRCLE_TAG#v}.vsix" ]; then
        echo "ERROR: ablunit-test-runner-${CIRCLE_TAG#v}.vsix not found, creating it now..."
        exit 1
    fi
    vsce publish --pre-release --githubBranch "main" --packagePath "ablunit-test-runner-v${CIRCLE_TAG}.vsix"
}

attach_to_github_release () {
    echo "[$0 ${FUNCNAME[0]}] TODO - not yet implemented"
}

########## MAIN BLOCK ##########
main_block
attach_to_github_release
echo "[$0] completed successfully"
