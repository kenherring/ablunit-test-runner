#!/bin/bash

## when we want to create a new non-prerelease simply run `npm version patch`
## or `npm version <tag>` and push the changes.  this should give us an even
## numbered patch that will flow to the main branch

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

        PATCH_NUM=$((${PACKAGE_VERSION##*.} + 1))
        echo "PATCH_NUM=$PATCH_NUM"
        if [ "$((PATCH_NUM % 2))" == "0" ]; then
            PATCH_NUM=$((PATCH_NUM+1))
            echo "PATCH_NUM=$PATCH_NUM"
        fi
        BUMP_TO_VERSION=${PACKAGE_VERSION%.*}.$((PATCH_NUM))
        echo "BUMP_TO_VERSION=$BUMP_TO_VERSION"

        npm version "$BUMP_TO_VERSION"
        BUMP_TO_VERSION=$(jq -r '.version' package.json)
        log_it "bumped version to '$BUMP_TO_VERSION'"
        echo "$BUMP_TO_VERSION"
        git push
    fi
}

########## MAIN BLOCK ##########
main
