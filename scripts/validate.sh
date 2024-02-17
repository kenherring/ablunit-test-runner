#!/bin/bash
set -euo pipefail

. scripts/common.sh

validate_results_count() {
	echo "[$0 ${FUNCNAME[0]}]"
	VERBOSE=${VERBOSE:-false}
	TEST_COUNT=$(find src/test/suite -name "*.test.ts" | wc -l)
	if [ ! -d artifacts ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: no artifacts directory found"
		exit 1
	fi

	RESULTS_COUNT=$(find artifacts -name "mocha_results_*.xml" | wc -l)
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: results count != test count ($RESULTS_COUNT != $TEST_COUNT)"
		exit 1
	fi

	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	if [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		echo "[$0 ${FUNCNAME[0]}] ERROR: lcov count != test count ($LCOV_COUNT != $TEST_COUNT)"
		exit 1
	fi

	if $VERBOSE; then
		echo "[$0 ${FUNCNAME[0]}] TEST_COUNT=$TEST_COUNT, RESULTS_COUNT=$RESULTS_COUNT, LCOV_COUNT=$LCOV_COUNT"
		find src/test/suite -name "*.test.ts"
		find artifacts -name "mocha_results_*.xml"
		find . -name 'lcov.info'
	fi

	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ] || [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		exit 1
	fi

}

########## MAIN BLOCK ##########
validate_version_updated
validate_results_count
echo "[$0] completed successfully!"
