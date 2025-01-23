#!/bin/bash

. scripts/common.sh

main () {
    if [ "${CIRCLE_BRANCH:-}" = "main" ]; then
        log_it "nothing to update for main branch"
        return
    fi

    PACKAGE_VERSION=$(jq -r '.version' package.json)
    GIT_TAG_VERSION=$(git tag -l --sort=version:refname | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '\.999$' | tail -1)
    echo "PACKAGE_VERSION=$PACKAGE_VERSION"
    echo "GIT_TAG_VERSION=$GIT_TAG_VERSION"

    if [ "$GIT_TAG_VERSION" = "$PACKAGE_VERSION" ]; then
        npm version patch
        BUMP_TO_VERSION=$(jq -r '.version' package.json)
        log_it "bumped version to '$BUMP_TO_VERSION'"
        echo "$BUMP_TO_VERSION"
        git push
    fi
}


########## MAIN BLOCK ##########
main
