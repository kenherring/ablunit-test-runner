#!/bin/bash
set -euo pipefail

. scripts/common.sh

validate_results_count() {
	echo "[$0 ${FUNCNAME[0]}] VERBOSE='${VERBOSE:-}'"
	VERBOSE=${VERBOSE:-false}
	TEST_COUNT=$(find src/test/suite -name "*.test.ts" | wc -l)
	if [ ! -d artifacts ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: no artifacts directory found"
		exit 1
	fi

	ARTIFACT_DIR="artifacts/${ABLUNIT_TEST_RUNNER_VSCODE_VERSION}-${OE_VERSION}"

	echo 100
	RESULTS_COUNT=$(find "$ARTIFACT_DIR" -name "mocha_results_junit*.xml" | sort -u | wc -l)
	echo 101
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ]; then
		echo 102
		echo "[$0 ${FUNCNAME[0]}] ERROR: results count != test count ($RESULTS_COUNT != $TEST_COUNT)"
		echo 103
	fi

	echo 110
	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	echo 111
	if [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		echo 112
		echo "[$0 ${FUNCNAME[0]}] ERROR: lcov count != test count ($LCOV_COUNT != $TEST_COUNT)"
		echo 113
	fi

	echo 120 "VERBOSE='${VERBOSE:-}'"
	if ${VERBOSE:-true}; then
		echo 121
		echo "[$0 ${FUNCNAME[0]}] TEST_COUNT=${TEST_COUNT:-}, RESULTS_COUNT=${RESULTS_COUNT:-}, LCOV_COUNT=${LCOV_COUNT:-}"
		echo 122
		find src/test/suite -name "*.test.ts" | sort
		echo 123
		find "$ARTIFACT_DIR" -name "mocha_results_*.xml" | sort
		echo 124
		find . -name 'lcov.info' | sort
		echo 125
	fi

	echo 130
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ] || [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		echo 131
		return 1
	fi
	echo 132
}

########## MAIN BLOCK ##########
validate_version_updated
validate_results_count
echo "[$0] completed successfully!"
