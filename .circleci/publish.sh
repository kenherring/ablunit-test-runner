#!/bin/bash
set -euo pipefail

main_block () {
    echo "[$0 ${FUNCNAME[0]}]"
    PRERELEASE=false

    if ! $CIRCLECI; then
        [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=$(git branch --show-current)
        [ -z "${CIRCLE_TAG:-}" ] && CIRCLE_TAG=$(git describe --tags --abbrev=0)
    fi

    if [ -z "${CIRCLE_TAG:-}" ]; then
        echo "ERROR: missing CIRCLE_TAG environment var"
        exit 1
    fi

    if [ ! -f "ablunit-test-runner-${CIRCLE_TAG}.vsix" ]; then
        echo "ERROR: ablunit-test-runner-${CIRCLE_TAG}.vsix not found"
        exit 1
    fi

    MINOR=$(echo "$CIRCLE_TAG" | cut -d. -f2)
    if [ "$(( MINOR % 2 ))" = "1" ]; then
        echo "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
        PRERELEASE=true
    fi

    npm install -g @vscode/vsce || sudo npm install -g @vscode/vsce
    echo "publishing file 'ablunit-test-runner-${CIRCLE_TAG}.vsix'"

    local ARGS=()
    ARGS+=("--githubBranch" "main")
    ARGS+=("--packagePath" "ablunit-test-runner-${CIRCLE_TAG}.vsix")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    vsce publish "${ARGS[@]}"
}

upload_to_github_release () {
    echo "[$0 ${FUNCNAME[0]}]"
    gh release upload "$CIRCLE_TAG" "ablunit-test-runner-${CIRCLE_TAG}.vsix" --clobber
    gh release upload "$CIRCLE_TAG" "ablunit-test-runner-insiders-${CIRCLE_TAG}.vsix" --clobber
}

########## MAIN BLOCK ##########
main_block
upload_to_github_release
echo "[$0] completed successfully"
