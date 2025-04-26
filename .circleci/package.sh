#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
    log_it
    ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-stable}
    PRERELEASE=${PRERELEASE:-true}

    if ! ${CIRCLECI:-false}; then
        ## local testing
        [ -z "${CIRCLE_TAG:-}" ] && [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_TAG=$(git tag --points-at HEAD)
        [ -z "${CIRCLE_TAG:-}" ] && [ -z "${CIRCLE_BRANCH:-}" ] && CIRCLE_BRANCH=$(git branch --show-current)
    fi

    if  [ -z "${CIRCLE_TAG:-}" ] && [ -z "${CIRCLE_BRANCH:-}" ]; then
        echo "ERROR: both CIRCLE_TAG and CIRCLE_BRANCH are set. exiting... (CIRCLE_TAG=$CIRCLE_TAG, CIRCLE_BRANCH=$CIRCLE_BRANCH)"
        exit 1
    fi

    PACKAGE_VERSION=$(jq -r '.version' package.json)
    echo "PACKAGE_VERSION=$PACKAGE_VERSION"
    PATCH=${PACKAGE_VERSION##*.}
    echo "PATCH_VERSION=$PATCH"
    if [ "$((PATCH % 2))" = "1" ]; then
        echo "version patch component is odd. packaging as prerelease. (PATCH=$PATCH)"
        PRERELEASE=true
    else
        echo "version patch component is even. packaging as stable release. (PATCH=$PATCH)"
        PRERELEASE=false
    fi
    echo "PRERELEASE=$PRERELEASE"

    rm -f ./*.vsix
}

package () {
    log_it
    package_version stable
    # package_version insiders
}

package_version () {
    local VSCODE_VERSION=$1
    # [ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != "$PACKAGE_VERSION" ] && [ -n "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" ] && return 0
    log_it "PACKAGE_VERSION=$VSCODE_VERSION"

    local ARGS=()
    ARGS+=("--githubBranch" "${CIRCLE_BRANCH:-main}")
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi
    if [ "$VSCODE_VERSION" != stable ]; then
        ARGS+=(-o "ablunit-test-runner-${VSCODE_VERSION}-${PACKAGE_VERSION}.vsix")
    fi

    if [ "$VSCODE_VERSION" != "stable" ]; then
        mv package.json package.bkup.json
        cp "package.$VSCODE_VERSION.json" package.json
    fi
    npm install
    npx vsce package "${ARGS[@]}"
    if [ "$VSCODE_VERSION" != "stable" ]; then
        mv package.bkup.json package.json
    fi
}

run_lint () {
	log_it
	if [ -n "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		log_it "skipping lint for single ABLUnit test runner project test"
		return 0
	fi

	local ESLINT_FILE=artifacts/eslint_report
	mkdir -p artifacts

    ESLINT_RETURN_CODE=0
	npm run lint -- -f json -o "${ESLINT_FILE}.json.tmp" || ESLINT_RETURN_CODE=$?
    log_it "eslint returned code=$ESLINT_RETURN_CODE"

    jq '.' < "${ESLINT_FILE}.json.tmp" > "${ESLINT_FILE}.json"
    rm -f "${ESLINT_FILE}.json.tmp"
    sed -i 's|/home/circleci/project/|/root/project/|g' "${ESLINT_FILE}.json"

    if [ ! -f "${ESLINT_FILE}.json" ]; then
        log_it "ERROR: ${ESLINT_FILE}.json not found"
        exit 1
    fi

    MESSAGE_COUNT=$(jq '[.[] | .messages | length] | add' < ${ESLINT_FILE}.json)
    ERROR_COUNT=$(jq '[.[] | .errorCount] | add' < ${ESLINT_FILE}.json)
    WARNING_COUNT=$(jq '[.[] | .warningCount] | add' < ${ESLINT_FILE}.json)

    log_it 'eslint summary:' \
        " - message count:  $MESSAGE_COUNT" \
        " - error count:    $ERROR_COUNT" \
        " - warning count:  $WARNING_COUNT"
}

########## MAIN BLOCK ##########
initialize
package
run_lint
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully"
