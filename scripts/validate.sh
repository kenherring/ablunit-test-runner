#!/bin/bash
set -euo pipefail

. scripts/common.sh

validate_results_count() {
	echo "[$0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	TEST_COUNT=$(find src/test/suite -name "*.test.ts" | wc -l)
	if $VERBOSE; then
		echo "[$0 ${FUNCNAME[0]}] TEST_COUNT=$TEST_COUNT"
		find src/test/suite -name "*.test.ts"
	fi

	if [ ! -d artifacts ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: no artifacts directory found"
		exit 1
	fi

	RESULTS_COUNT=$(find artifacts -name "mocha_results_*.xml" | wc -l)
	if $VERBOSE; then
		echo "[$0 ${FUNCNAME[0]}] RESULTS_COUNT=$RESULTS_COUNT"
		find artifacts -name "mocha_results_*.xml"
	fi
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: results count != test count ($RESULTS_COUNT != $TEST_COUNT)"
		exit 1
	fi

	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	if $VERBOSE; then
		echo "[$0 ${FUNCNAME[0]}] LCOV_COUNT=$LCOV_COUNT"
		find . -name 'lcov.info'
	fi
	if [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: lcov count != test count ($LCOV_COUNT != $TEST_COUNT)"
		exit 1
	fi
}

########## MAIN BLOCK ##########
validate_version_updated
validate_results_count
echo "[$0] completed successfully!"
