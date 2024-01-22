#!/bin/bash
set -euo pipefail

initialize () {
    echo "[$0 ${FUNCNAME[0]}]"
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH=$(git branch --show-current)
    fi

    if ! $CIRCLECI && [ -z "$CIRCLE_TAG" ]; then
        CIRCLE_TAG=$(git describe --tags --abbrev=0)
    fi
    if [ -z "$CIRCLE_TAG" ]; then
        echo "ERROR: missing CIRCLE_TAG environment var"
        exit 1
    fi

    MINOR=$(echo "$CIRCLE_TAG" | cut -d. -f2)
    if [ "$(( MINOR % 2 ))" = "1" ]; then
        echo "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
        PRERELEASE=true
    fi

    npm install
    npm install -g @vscode/vsce || sudo npm install -g @vscode/vsce
}

package () {
    echo "[$0 ${FUNCNAME[0]}]"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    vsce package "${ARGS[@]}"
}

########## MAIN BLOCK ##########
initialize
package
echo "[$0] completed successfully"
