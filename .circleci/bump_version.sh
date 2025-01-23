#!/bin/bash

. scripts/common.sh

main () {
    log_it
    PACKAGE_VERSION=$(jq -r '.version' package.json)
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    if [ "${CIRCLE_BRANCH:-}" = "main" ]; then
        push_tag
        return
    fi

    if ! git tag -l --sort=version:refname | grep -q "^$PACKAGE_VERSION$"; then
        log_it "no tag exists for PACKAGE_VERSION=$PACKAGE_VERSION, nothing more to do..."
        return 0
    fi

    if ${CIRCLECI:-}; then
        if ! git config --get user.email &>/dev/null; then
            git config user.email "circleci@ablunit-test-runner.kenherring.com"
        fi
        if ! git config --get user.name &>/dev/null; then
            git config user.name "CircleCI"
        fi
        git config push.autoSetupRemote true
    fi

    bump_prerelease_version
}

bump_prerelease_version () {
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    PATCH_NUM=$((${PACKAGE_VERSION##*.} + 1))
    if [ "$((PATCH_NUM % 2))" = "0" ]; then
        ## always bump to an odd number for pre-release
        ## even number releases are set manually and pushed
        PATCH_NUM=$((PATCH_NUM + 1))
    fi

    BUMP_TO_VERSION=${PACKAGE_VERSION%.*}.$PATCH_NUM
    while git tag -l --sort=version:refname | grep -q -E "^$BUMP_TO_VERSION$"; do
        log_it "tag '$BUMP_TO_VERSION' already exists..."
        PATCH_NUM=$((PATCH_NUM + 2))
        BUMP_TO_VERSION=${PACKAGE_VERSION%.*}.$PATCH_NUM
    done
    log_it "bumping version to $BUMP_TO_VERSION"

    npm version "$BUMP_TO_VERSION" --no-tag-git-version -m "Bump version to prerelease %s"
    git push
}

## when building the main branch, set the tag to the version in package.json
push_tag () {
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    PATCH_NUM=$((${PACKAGE_VERSION##*.} + 1))

    log_it "create tag $PACKAGE_VERSION and push"
    npm version "$PACKAGE_VERSION" --allow-same-ver
    git push origin tag "$PACKAGE_VERSION"
}

########## MAIN BLOCK ##########
main
