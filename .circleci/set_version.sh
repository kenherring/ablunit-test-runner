#!/bin/bash

. scripts/common.sh

main () {
    log_it
    PACKAGE_VERSION=$(jq -r '.version' package.json)
    if [ "${CIRCLE_BRANCH:-}" = "main" ]; then
        create_tag
        return
    fi

    GIT_TAG_VERSION=$(git tag -l --sort=version:refname | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '\.999$' | tail -1)
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    log_it "GIT_TAG_VERSION=$GIT_TAG_VERSION"

    if [ "$GIT_TAG_VERSION" = "$PACKAGE_VERSION" ]; then
        npm version patch
        BUMP_TO_VERSION=$(jq -r '.version' package.json)
        log_it "bumped version to '$BUMP_TO_VERSION'"
        git push
    fi
}

create_tag () {
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    ## when building the main branch, set the tag to the version in package.json
    npm version "$PACKAGE_VERSION"
    git push
}

########## MAIN BLOCK ##########
main
