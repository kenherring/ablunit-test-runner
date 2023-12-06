#!/bin/bash
set -eou pipefail

initialize () {
	BASH_AFTER_FAIL=false
	while getopts 'b' OPT; do
		case "$OPT" in
			b)	BASH_AFTER_FAIL=true ;;
			?)	echo "script usage: $(basename "$0") [-b]" >&2
				exit 1 ;;
		esac
	done

	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

	if ! ${CIRCLECI:-false}; then
		echo 'copying files'
		cd /home/circleci/project
		git config --global init.defaultBranch main
		git init
		git remote add origin /home/circleci/ablunit-test-provider
		git fetch origin
		if [ "$GIT_BRANCH" = "$(git branch show-current)" ]; then
			git reset --hard "origin/$GIT_BRANCH"
		else
			git checkout "$GIT_BRANCH"
		fi

		cd /home/circleci/ablunit-test-provider
		git --no-pager diff --diff-filter=d --name-only --staged > /tmp/stage_files
		git --no-pager diff --diff-filter=D --name-only --staged > /tmp/deleted_files
		git --no-pager diff --diff-filter=d --name-only > /tmp/modified_files
		cd -


		while read -r FILE; do
			echo "copying staged file $FILE"
			cp "/home/circleci/ablunit-test-provider/$FILE" "$FILE"
		done < /tmp/stage_files

		while read -r FILE; do
			echo "copying modified file $FILE"
			cp "/home/circleci/ablunit-test-provider/$FILE" "$FILE"
		done < /tmp/modified_files

		while read -r FILE; do
			echo "deleting deleted file $FILE"
			rm "$FILE"
		done < /tmp/deleted_files
	fi

	scripts/cleanup.sh
}

run_tests () {
	echo "starting tests..."
	if ! .circleci/run_test_wrapper.sh; then
		if $BASH_AFTER_FAIL; then
			bash
		else
			exit 1
		fi
	fi
}

analyze_results () {
	RESULTS_COUNT=$(find . -name 'mocha_results_*.xml' | wc -l)
	LCOV_COUNT=$(find . -name 'lcov.info' | wc -l)
	HAS_ERROR=false

	if [ "$RESULTS_COUNT" = 0 ]; then
		echo 'ERROR: mocha_results_*.xml not found'
		HAS_ERROR=true
	fi
	if [ "$LCOV_COUNT" = 0 ]; then
		echo 'ERROR: lcov.info not found'
		HAS_ERROR=true
	fi

	if $HAS_ERROR; then
		if $BASH_AFTER_FAIL; then
			bash
		fi
		exit 1
	fi
}

finish () {
	echo "Artifacts to be saved:"
	ls -al artifacts
	echo 'done running tests'
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests
teardown
analyze_results
finish
