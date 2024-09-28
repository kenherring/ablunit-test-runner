#!/bin/bash
set -eou pipefail

main_block () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
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

    echo "publishing file 'ablunit-test-runner-${CIRCLE_TAG}.vsix'"

    local ARGS=()
    ARGS+=("--githubBranch" "main")
    ARGS+=("--packagePath" "ablunit-test-runner-${CIRCLE_TAG}.vsix")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    npx vsce publish "${ARGS[@]}"
}

upload_to_github_release () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    sudo apt-get install --no-install-recommends -y gh
    gh release upload "$CIRCLE_TAG" "ablunit-test-runner-${CIRCLE_TAG}.vsix" --clobber
    gh release upload "$CIRCLE_TAG" "ablunit-test-runner-insiders-${CIRCLE_TAG}.vsix" --clobber
}

########## MAIN BLOCK ##########
main_block
upload_to_github_release
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully"
