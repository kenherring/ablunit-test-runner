#!/bin/bash
set -eou pipefail

. scripts/common.sh

validate_results_count() {
	log_it "VERBOSE='${VERBOSE:-}'"
	EXPECTED_VSIX_COUNT=${EXPECTED_VSIX_COUNT:-1}
	VERBOSE=${VERBOSE:-false}
	TEST_COUNT=$(find test/suites -name "*.test.ts" | wc -l)
	if [ ! -d artifacts ]; then
		log_error "no 'artifacts' directory found"
		exit 1
	fi

	RESULTS_COUNT=$(find "artifacts/mocha_results_xunit" -name "*.xml" | sort -u | wc -l)
	if [ "$RESULTS_COUNT" != "$TEST_COUNT" ]; then
		log_error "results count != test count ($RESULTS_COUNT != $TEST_COUNT)"
	fi

	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	if [ "$LCOV_COUNT" != "1" ]; then
		log_error "LCOV_COUNT != 1 ($LCOV_COUNT != 1)"
		exit 1
	fi

	if ${VERBOSE:-true}; then
		log_it "TEST_COUNT=${TEST_COUNT:-}, RESULTS_COUNT=${RESULTS_COUNT:-}, LCOV_COUNT=${LCOV_COUNT:-}"
		find test/suites -name "*.test.ts" | sort
		find "$ARTIFACT_DIR" -name "mocha_results_*.xml" | sort
		find . -name 'lcov.info' | sort
	fi

	if [ -n "$ABLUNIT_TEST_RUNNER_PROJECT_NAME" ]; then
		if [ "$RESULTS_COUNT" != "$TEST_COUNT" ] || [ "$LCOV_COUNT" != "$EXPECTED_VSIX_COUNT" ]; then
			log_error "results count != test count ($RESULTS_COUNT != $TEST_COUNT) or LCOV_COUNT != 1 ($LCOV_COUNT != 1)"
			return 1
		fi
	fi
}

########## MAIN BLOCK ##########
validate_version_updated
validate_results_count
log_it 'completed successfully!'
