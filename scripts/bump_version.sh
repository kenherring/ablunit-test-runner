#!/bin/bash

. scripts/common.sh

main () {
    log_it
    PACKAGE_VERSION=$(jq -r '.version' package.json)
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    if [ "${CIRCLE_BRANCH:-}" = "main" ]; then
        log_it "nothing more to do, this is the main branch and we're building PACKAGE_VERSION=$PACKAGE_VERSION"
        return
    fi
    if [ "$(git log -1 '--pretty=%aN')" = "dependabot[bot]" ]; then
        log_it "nothing more to do, this is a dependabot PR"
        return
    fi

    if ! git tag -l --sort=version:refname | grep -q "^$PACKAGE_VERSION$"; then
        log_it "no tag exists for PACKAGE_VERSION=$PACKAGE_VERSION, nothing more to do..."
        return 0
    fi

    if ${CIRCLECI:-}; then
        if ! git config --get user.email &>/dev/null; then
            LAST_COMMITTER_EMAIL=$(git log -1 --pretty='%ae')
            git config user.email "${LAST_COMMITTER_EMAIL:-noreply@ablunit-test-runner.kenherring.com}"
        fi
        if ! git config --get user.name &>/dev/null; then
            LAST_COMMITTER_USER=$(git log -1 --pretty='%an')
            git config user.name "${LAST_COMMITTER_USER:-CI Workflow}"
        fi
        git config push.autoSetupRemote true
    fi

    bump_prerelease_version
}

bump_prerelease_version () {
    log_it "PACKAGE_VERSION=$PACKAGE_VERSION"
    PATCH_NUM=$((${PACKAGE_VERSION##*.} + 1))
    if [ "$((PATCH_NUM % 2))" = "0" ]; then
        ## always bump to an odd number for prerelease
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

    echo "GITHUB_REF=$GITHUB_REF"
    echo "GITHUB_REF_NAME=$GITHUB_REF_NAME"
    echo "GITHUB_REF_TYPE=$GITHUB_REF_TYPE"
    gh workflow run --ref "${GITHUB_REF:-}" "CI Workflow"
    log_error "pushed $GITHUB_REF, exit_code=1"
    exit 1
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
