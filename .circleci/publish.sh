#!/bin/bash
set -eou pipefail

main_block () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

    if ! ${CIRCLECI:-false}; then
        ## local testing
        CIRCLE_BUILD_NUM=${CIRCLE_BUILD_NUM:-999}
        if [ -z "${CIRCLE_BRANCH:-}" ] && [ -z "${CIRCLE_TAG:-}" ]; then
            CIRCLE_BRANCH=$(git branch --show-current)
        fi
    fi

    if [ -n "${CIRCLE_TAG:-}" ]; then
        PRERELEASE=$(gh release view 1.0.0 --json isPrerelease | jq '.isPrerelease')
        echo "tag $CIRCLE_TAG PRERELEASE=$PRERELEASE"
    else
        if ! ${PRERELEASE:-false} && [ "$CIRCLE_BRANCH" != "main" ]; then
            echo "PRERELEASE is not set, there is nothing to publish (CIRCLE_BRANCH=$CIRCLE_BRANCH)"
            exit 0
        fi
        PRERELEASE=${PRERELEASE:-true}
    fi

    if $PRERELEASE; then
        prerelease
    else
        release
    fi
}

prerelease () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    PRERELEASE=${PRERELEASE:-true}
    if ! $PRERELEASE; then
        echo "ERROR: PRERELEASE is not set to true"
        exit 1
    fi

    PACKAGE_VERSION=$(jq -r '.version' package.json)
    echo "PACKAGE_VERSION=$PACKAGE_VERSION"
    PRERELEASE_VERSION=${PACKAGE_VERSION%.*}.$CIRCLE_BUILD_NUM
    echo "PRERELEASE_VERSION=$PRERELEASE_VERSION"

    git config --global user.email "ablunit-test-runner@circleci"
    git config --global user.name "CircleCI"

    npm version "$PRERELEASE_VERSION"
    .circleci/package.sh
    git push origin tag "$PRERELEASE_VERSION"

    local ARGS=()
    ARGS+=("--githubBranch" "main") ## used to infer lints
    ARGS+=("--packagePath" "ablunit-test-runner-${PRERELEASE_VERSION}.vsix")
    ARGS+=("--pre-release")
    npx vsce publish "${ARGS[@]}"
}

release () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

    if [ ! -f "ablunit-test-runner-${CIRCLE_TAG}.vsix" ]; then
        echo "ERROR: ablunit-test-runner-${CIRCLE_TAG}.vsix not found"
        exit 1
    fi

    if [ "$CIRCLE_TAG" != "$PACKAGE_VERSION" ]; then
        echo "ERROR: CIRCLE_TAG=$CIRCLE_TAG does not match PACKAGE_VERSION=$PACKAGE_VERSION"
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
