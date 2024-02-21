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

	RESULTS_COUNT=$(find "$ARTIFACT_DIR" -name "mocha_results_junit*.xml" | sort -u | wc -l)
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: results count != test count ($RESULTS_COUNT != $TEST_COUNT)"
	fi

	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	if [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: lcov count != test count ($LCOV_COUNT != $TEST_COUNT)"
	fi

	if ${VERBOSE:-true}; then
		echo "[$0 ${FUNCNAME[0]}] TEST_COUNT=${TEST_COUNT:-}, RESULTS_COUNT=${RESULTS_COUNT:-}, LCOV_COUNT=${LCOV_COUNT:-}"
		find src/test/suite -name "*.test.ts" | sort
		find "$ARTIFACT_DIR" -name "mocha_results_*.xml" | sort
		find . -name 'lcov.info' | sort
	fi

	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ] || [ "$LCOV_COUNT" != "1" ]; then
		return 1
	fi
}

########## MAIN BLOCK ##########
validate_version_updated
validate_results_count
echo "[$0] completed successfully!"
