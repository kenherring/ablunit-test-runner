#!/bin/bash
set -eou pipefail

main_block () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    PRERELEASE=false

    if ! ${CIRCLECI:-false}; then
        ## local testing

        [ -z "${CIRCLE_TAG:-}" ] && CIRCLE_TAG=$(git tag --points-at HEAD)
        if [ -z "${CIRCLE_TAG:-}" ]; then
            [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=$(git branch --show-current)
        fi
    fi

    PACKAGE_VERSION=$(jq -r '.version' package.json)
    echo "PACKAGE_VERSION=$PACKAGE_VERSION"
    PATCH_VERSION=${PACKAGE_VERSION##*.}
    echo "PATCH_VERSION=$PATCH_VERSION"
    if [ "$((PATCH_VERSION % 2))" = "1" ]; then
        ## Odd patch version is always a pre-release
        PRERELEASE=true
    fi
    echo "PRERELEASE=$PRERELEASE"

    if [ -n "${CIRCLE_TAG:-}" ] && [ "$CIRCLE_TAG" != "$PACKAGE_VERSION" ]; then
        log_error "CIRCLE_TAG=$CIRCLE_TAG does not match PACKAGE_VERSION=$PACKAGE_VERSION"
        return 1
    fi

    publish_release
    if [ -n "$CIRCLE_TAG" ]; then
        upload_to_github_release
    fi
}

publish_release () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

    if [ ! -f "ablunit-test-runner-${PACKAGE_VERSION}.vsix" ]; then
        echo "ERROR: ablunit-test-runner-${PACKAGE_VERSION}.vsix not found"
        exit 1
    fi

    echo "publishing file 'ablunit-test-runner-${CIRCLE_TAG}.vsix'"

    local ARGS=()
    ARGS+=("--githubBranch" "main")
    ARGS+=("--packagePath" "ablunit-test-runner-${CIRCLE_TAG}.vsix")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    npx vsce publish "${ARGS[@]}"

    upload_to_github_release
}

upload_to_github_release () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    local GH_TOKEN=$GH_TOKEN_PUBLISH
    export GH_TOKEN
    sudo apt update
    sudo apt install --no-install-recommends -y gh
    gh release upload "$CIRCLE_TAG" "ablunit-test-runner-${CIRCLE_TAG}.vsix" --clobber
}

########## MAIN BLOCK ##########
main_block
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully"
