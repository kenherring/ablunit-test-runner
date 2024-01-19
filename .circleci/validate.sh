#!/bin/bash
set -euo pipefail

. scripts/common.sh

validate_results_count() {
	TEST_COUNT=$(find src/test/suite -name "*.test.ts" | wc -l)
	echo "TEST_COUNT=$TEST_COUNT"

	RESULTS_COUNT=$(find artifacts -name "mocha_results_*.xml" | wc -l)
	echo "RESULTS_COUNT=$RESULTS_COUNT"
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ]; then
		echo "No test results found"
		exit 1
	fi

	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	echo "LCOV_COUNT=$LCOV_COUNT"
	if [ "$LCOV_COUNT" != "$TEST_COUNT" ]; then
		echo 'ERROR: lcov.info not found'
		exit 1
	fi
}

########## MAIN BLOCK ##########
validate_results_count
validate_version_updated
