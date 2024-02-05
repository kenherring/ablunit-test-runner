#!/bin/bash
set -euo pipefail

initialize () {
    echo "[$0 ${FUNCNAME[0]}]"
    PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH=$(git branch --show-current)
    fi

    if [ -z "${CIRCLE_TAG:-}" ]; then
        CIRCLE_TAG=$PACKAGE_VERSION
    fi
    if [ -z "${CIRCLE_TAG:-}" ]; then
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
    package_stable
    package_insiders
}

package_stable () {
    echo "[$0 ${FUNCNAME[0]}]"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi

    cp package.stable.json package.json
    vsce package "${ARGS[@]}"
}

package_insiders () {
    echo "[$0 ${FUNCNAME[0]}]"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi

    ARGS+=("--ignoreFile" ".vscodeignore.insiders")

    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    echo "PACKAGE_VERSION=$PACKAGE_VERSION"

    cp package.insiders.json package.json
    vsce package "${ARGS[@]}"
    mv package.stable.json package.json
    rm package.stable.json
}



########## MAIN BLOCK ##########
initialize
package
echo "[$0] completed successfully"
