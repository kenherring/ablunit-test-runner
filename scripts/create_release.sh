#!/bin/bash

## Automatically publish pre-release branches
## Creates a release in GitHub with the current version as a tag and
## This tag will run another workflow to publish the release to the marketplace

. scripts/common.sh

main () {
    log_it

    if [ ! -f package.json ]; then
        log_error "package.json not found - is the repo checked out?"
        exit 1
    fi

    PACKAGE_VERSION=$(jq -r '.version' package.json)
    if git tag -l --sort=version:refname | grep -q "^$PACKAGE_VERSION$"; then
        log_error "tag exists for PACKAGE_VERSION=$PACKAGE_VERSION"
        exit 1
    fi

    PRERELEASE=false
    PATCH_VERSION=${PACKAGE_VERSION##*.}
    if [ "$((PATCH_VERSION % 2))" = "1" ]; then
        PRERELEASE=true
    fi

    if [ -z "$(git tag)" ]; then
        git fetch --tags
    fi
    LATEST_RELEASE_TAG=$(git tag -l '[0-9].*' --sort=version:refname | grep -E "^[0-9]+\.[0-9]+\.[0-9]*[0,2,4,6,8]$" | tail -1)

    ARGS=()
    if $PRERELEASE; then
        ARGS+=(--prerelease)
        ARGS+=(--title "$PACKAGE_VERSION (prerelease)")
        if ! ${CIRCLECI:-false}; then
            ARGS+=(--draft)
        fi
    else
        ARGS+=(--draft)
        ARGS+=(--title "$PACKAGE_VERSION")
    fi
    ARGS+=(--generate-notes)
    ARGS+=(--notes-start-tag "$LATEST_RELEASE_TAG")
    ARGS+=(--target $(git rev-parse HEAD))

    gh release create "$PACKAGE_VERSION" "${ARGS[@]}"
    log_it "release created for PACKAGE_VERSION=$PACKAGE_VERSION"
}

########## MAIN BLOCK ##########
main
