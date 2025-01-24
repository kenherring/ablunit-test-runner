#!/bin/bash
set -eou pipefail

. scripts/common.sh

main_block () {
    log_it
    PRERELEASE=false

    if ! ${CIRCLECI:-false}; then
        ## local testing

        [ -z "${CIRCLE_TAG:-}" ] && CIRCLE_TAG=$(git tag --points-at HEAD)
        if [ -z "${CIRCLE_TAG:-}" ]; then
            [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=$(git branch --show-current)
        fi
    fi

    validate_tag
    publish_release
    if [ -n "${CIRCLE_TAG:-}" ]; then
        upload_to_github_release
    fi
}

validate_tag () {
    log_it
    PACKAGE_VERSION=$(jq -r '.version' package.json)
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    PATCH_VERSION=${PACKAGE_VERSION##*.}
    log_it "PATCH_VERSION=$PATCH_VERSION"
    if [ "$((PATCH_VERSION % 2))" = "1" ]; then
        ## Odd patch version is always a pre-release
        PRERELEASE=true
    elif [ -z "${CIRCLE_TAG}" ]; then
        log_it "CIRCLE_TAG is not defined and the patch number is even indicating this is not a prerelease.  Nothing to do now, deployment occurs when the GitHub release is created"
        return 0
    fi
    log_it "PRERELEASE=$PRERELEASE"

    if [ -n "${CIRCLE_TAG:-}" ] && [ "$CIRCLE_TAG" != "$PACKAGE_VERSION" ]; then
        log_error "CIRCLE_TAG=$CIRCLE_TAG does not match PACKAGE_VERSION=$PACKAGE_VERSION"
        return 1
    fi

    if [ ! -f "ablunit-test-runner-${PACKAGE_VERSION}.vsix" ]; then
        log_error "ablunit-test-runner-${PACKAGE_VERSION}.vsix not found"
        exit 1
    fi
}

publish_release () {
    log_it  "publishing file 'ablunit-test-runner-${PACKAGE_VERSION}.vsix'"

    local ARGS=()
    ARGS+=("--githubBranch" "main")
    ARGS+=("--packagePath" "ablunit-test-runner-${PACKAGE_VERSION}.vsix")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    npx vsce publish "${ARGS[@]}"
}

upload_to_github_release () {
    log_it
    local GH_TOKEN=$GH_TOKEN_PUBLISH
    export GH_TOKEN

    curl -L https://github.com/cli/cli/releases/download/v2.65.0/gh_2.65.0_linux_amd64.deb -o /tmp/gh_2.65.0_linux_amd64.deb
    sudo dpkg -i /tmp/gh_2.65.0_linux_amd64.deb

    gh release upload "$PACKAGE_VERSION" "ablunit-test-runner-${PACKAGE_VERSION}.vsix" --clobber
}

########## MAIN BLOCK ##########
main_block
log_it "completed successfully"
