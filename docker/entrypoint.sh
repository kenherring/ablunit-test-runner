#!/bin/bash
set -eou pipefail

initialize () {
	echo "[$0 initialize]"
	BASH_AFTER_FAIL=false
	REPO_VOLUME=/home/circleci/ablunit-test-provider

	while getopts 'b' OPT; do
		case "$OPT" in
			b)	BASH_AFTER_FAIL=true ;;
			?)	echo "script usage: $(basename "$0") [-b]" >&2
				exit 1 ;;
		esac
	done

	## save my license from the environment variable at runtime
	tr ' ' '\n' <<< "$PROGRESS_CFG_BASE64" | base64 --decode > /psc/dlc/progress.cfg

	echo 'copying files from local'
	initialize_repo
	copy_files_from_volume
	npm install
}

initialize_repo () {
	echo "[$0 initialize_repo]"
	cd /home/circleci/project
	git config --global init.defaultBranch main
	git init
	git remote add origin "$REPO_VOLUME"
	git fetch origin
	if [ "$GIT_BRANCH" = "$(git branch --show-current)" ]; then
		git reset --hard "origin/$GIT_BRANCH"
	else
		git checkout "$GIT_BRANCH"
	fi
}

copy_files_from_volume () {
	echo "[$0 copy_files_from_volume]"
	find_files_to_copy
	copy_files "staged"
	[ -f /tmp/modified_files ] && copy_files "modified"
	while read -r FILE; do
		echo "deleting deleted file $FILE"
		rm "$FILE"
	done < /tmp/deleted_files
}

find_files_to_copy () {
	echo "[$0 find_files_to_copy]"
	cd "$REPO_VOLUME"
	git config --global --add safe.directory "$REPO_VOLUME"

	git --no-pager diff --diff-filter=d --name-only --staged --ignore-cr-at-eol > /tmp/staged_files
	git --no-pager diff --diff-filter=D --name-only --staged --ignore-cr-at-eol > /tmp/deleted_files

	if ! ${STAGED_ONLY:-false}; then
		git --no-pager diff --diff-filter=d --name-only --ignore-cr-at-eol > /tmp/modified_files
	fi
	cd -
}

copy_files () {
	echo "[$0 copy_files]"
	local TYPE="$1"
	while read -r FILE; do
		echo "copying $TYPE file $FILE"
		if [ ! -d "$(dirname "$FILE")" ]; then
			mkdir -p "$(dirname "$FILE")"
		fi
		cp "$REPO_VOLUME/$FILE" "$FILE" || true
	done < "/tmp/${TYPE}_files"
}

run_tests () {
	echo "[$0 run_tests]"
	exit 1
	if ! .circleci/run_test_wrapper.sh; then
		echo "run_tests failed"
		if $BASH_AFTER_FAIL; then
			bash
			exit 1
		else
			exit 1
		fi
	fi
	echo "run_tests success"
}

analyze_results () {
	echo "[$0 analyze_results]"
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
	echo "[$0 finish] artifacts to be saved:"
	ls -al artifacts
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests
analyze_results
finish
echo "[$0] completed successfully!"
