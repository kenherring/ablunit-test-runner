#!/bin/bash
set -eou pipefail

initialize () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-stable}
    PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    if [ -z "${CIRCLE_BRANCH:-}" ]; then
        CIRCLE_BRANCH=$(git branch --show-current)
    fi

    if [ -z "${CIRCLE_TAG:-}" ]; then
        CIRCLE_TAG=$PACKAGE_VERSION
    fi
    if [ -z "${CIRCLE_TAG:-}" ]; then
        echo "ERROR: missing CIRCLE_TAG environment var"
        exit 1
    fi

    MINOR=$(echo "$CIRCLE_TAG" | cut -d. -f2)
    if [ "$(( MINOR % 2 ))" = "1" ]; then
        echo "minor tag is odd. packaging as pre-release. (MINOR=$MINOR)"
        PRERELEASE=true
    fi

    rm -f ./*.vsix
}

package () {
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
    package_version stable
    # package_version insiders
}

package_version () {
    local VSCODE_VERSION=$1
    # [ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != "$PACKAGE_VERSION" ] && [ -n "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" ] && return 0
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] PACKAGE_VERSION=$VSCODE_VERSION"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
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
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"
	if [ -n "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ]; then
		echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] skipping lint for single ABLUnit test runner project test"
		return 0
	fi

	local ESLINT_FILE=artifacts/eslint_report
	mkdir -p artifacts

    ESLINT_RETURN_CODE=0
	npm run lint -- -f json -o "${ESLINT_FILE}.json.tmp" || ESLINT_RETURN_CODE=$?
    echo "eslint returned code=$ESLINT_RETURN_CODE"

    jq '.' < "${ESLINT_FILE}.json.tmp" > "${ESLINT_FILE}.json"
    sed -i 's|/home/circleci/project/|/root/project/|g' "${ESLINT_FILE}.json"

    if [ ! -f "${ESLINT_FILE}.json" ]; then
        echo "ERROR: ${ESLINT_FILE}.json not found"
        exit 1
    fi

    MESSAGE_COUNT=$(jq '[.[] | .messages | length] | add' < ${ESLINT_FILE}.json.tmp)
    ERROR_COUNT=$(jq '[.[] | .errorCount] | add' < ${ESLINT_FILE}.json.tmp)
    WARNING_COUNT=$(jq '[.[] | .warningCount] | add' < ${ESLINT_FILE}.json.tmp)

    echo 'eslint summary:'
    echo " - message count:  $MESSAGE_COUNT"
    echo " - error count:    $ERROR_COUNT"
    echo " - warning count:  $WARNING_COUNT"
}

########## MAIN BLOCK ##########
initialize
package
run_lint
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully"
