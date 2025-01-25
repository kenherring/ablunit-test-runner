#!/bin/bash

## Automatically publish pre-release branches
## Creates a release in GitHub with the current version as a tag and
## This tag will run another workflow to publish the release to the marketplace

. scripts/common.sh

main () {
    log_it

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

    set -x
    env
    curl -L https://github.com/cli/cli/releases/download/v2.65.0/gh_2.65.0_linux_amd64.deb -o /tmp/gh_2.65.0_linux_amd64.deb
    sudo dpkg -i /tmp/gh_2.65.0_linux_amd64.deb

    export GH_ENTERPRISE_TOKEN="$GH_TOKEN"
    echo "GH_TOKEN=$GH_TOKEN"

    if ! gh release create "$PACKAGE_VERSION" "${ARGS[@]}"; then
        gh auth login --with-token <<< "$GH_TOKEN"
        gh release create "$PACKAGE_VERSION" "${ARGS[@]}"
    fi
    log_it "release created for PACKAGE_VERSION=$PACKAGE_VERSION"
}

########## MAIN BLOCK ##########
main
