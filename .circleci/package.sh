#!/bin/bash
set -euo pipefail

initialize () {
    echo "[$0 ${FUNCNAME[0]}]"
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

    npm install
    npm install -g @vscode/vsce || sudo npm install -g @vscode/vsce
}

package () {
    echo "[$0 ${FUNCNAME[0]}]"
    package_insiders
    package_stable
}

package_stable () {
    echo "[$0 ${FUNCNAME[0]}]"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi

    cp package.proposedapi.json package.json
    vsce package "${ARGS[@]}" -o "ablunit-test-runner-proposedapi-${PACKAGE_VERSION}.vsix"
    cp package.stable.json package.json

    cp package.stable.json package.json
    vsce package "${ARGS[@]}"
}

package_insiders () {
    echo "[$0 ${FUNCNAME[0]}]"

    local ARGS=()
    ARGS+=("--githubBranch" "$CIRCLE_BRANCH")
    ARGS+=("--no-git-tag-version")
    if $PRERELEASE; then
        ARGS+=("--pre-release")
    fi

    ARGS+=("--ignoreFile" ".vscodeignore.insiders")

    PACKAGE_VERSION=$(node -p "require('./package.json').version")
    echo "PACKAGE_VERSION=$PACKAGE_VERSION"

    cp package.insiders.json package.json
    vsce package "${ARGS[@]}" -o "ablunit-test-runner-insiders-${PACKAGE_VERSION}.vsix"
    cp package.stable.json package.json
}

run_lint () {
	echo "[$0 ${FUNCNAME[0]}]"
	# if [ -n "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ]; then
	# 	echo "[$0 ${FUNCNAME[0]}] skipping lint for single ABLUnit test runner project test"
	# 	return 0
	# fi

	local ESLINT_FILE=artifacts/eslint_report
    npm install
	mkdir -p artifacts

	if ! npm run lint -- -f unix -o "${ESLINT_FILE}.txt"; then
		echo "eslint plain failed"
	fi
	if ! npm run lint -- -f json -o "${ESLINT_FILE}.json"; then
		## sonarqube report
		echo "eslint json failed"
	fi
	if [ "$(find artifacts -name "eslint_report.json" | wc -l)" != "0" ]; then
		jq '.' < "${ESLINT_FILE}.json" > "${ESLINT_FILE}_pretty.json"
	else
		echo "ERROR: ${ESLINT_FILE}.json not found"
		exit 1
	fi
	echo 'eslint successful'
}

########## MAIN BLOCK ##########
initialize
package
run_lint
echo "[$0] completed successfully"
