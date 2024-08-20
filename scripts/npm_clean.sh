#!/bin/bash
set -eou pipefail

main_block () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 main_block] starting script (pwd=$(pwd))"

	AGGRESSIVE_FLAG=false
	[ "${1:-}" = '-a' ] && AGGRESSIVE_FLAG=true

	initialize
	delete_directories &
	delete_files &
	wait
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 main_block] cleanup complete!"
}

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] intiailizing..."

	DIRS=(
		".builder"
		".nyc_output"
		".scannerwork"
		# "artifacts/*"
		# "coverage/*"
		"dist"
		"out"
		"tmp"
	)
	$AGGRESSIVE_FLAG && DIRS+=(".vscode-test" "node_modules")
	if [ "${OS:-}" = "Windows_NT" ]; then
		DIRS+=("C:/temp/ablunit/")
	else
		DIRS+=("/tmp/ablunit/")
	fi

	TEST_PROJECT_DIRS=(
		".builder"
		"ablunit-output"
		"build"
		"listings"
		"target"
		"temp"
		"workspaceAblunit"
	)

	TEST_PROJECT_PATTERNS=(
		"*.r"
		"*.restore"
		"*.xref"
		"ablunit.json"
		"ablunit.log"
		"dbg_*"
		"prof.json"
		"prof.out"
		"profile.json"
		"profile.options"
		"profiler.json"
		"progress.ini"
		"protrace.*"
		"results.json"
		"results.prof"
		"results.xml"
	)
	FILE_PATTERNS=("*.vsix")
	rm -f .vscode-test/user-data/User/settings.json
}

delete_directories () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] deleting directories..."
	local DIR LOOP_COUNT=0 DIR_COUNT=0

	for DIR in "${DIRS[@]}"; do
		[ -d "$DIR" ] || continue
		LOOP_COUNT=1
		echo "delete DIR=$DIR (LOOP_COUNT=$LOOP_COUNT)"
		DIR_COUNT=$((DIR_COUNT+LOOP_COUNT))
		rm -rf "$DIR" &
	done

	for DIR in "${TEST_PROJECT_DIRS[@]}"; do
		LOOP_COUNT=$(find test_projects -type d -name "$DIR" | wc -l)
		[ "$LOOP_COUNT" = "0" ] && continue
		echo "delete DIR=test_projects/$DIR (LOOP_COUNT=$LOOP_COUNT)"
		DIR_COUNT=$((DIR_COUNT+LOOP_COUNT))
		find test_projects -type d -name "$DIR" -exec rm -rv {} + &
	done

	echo "deleted $DIR_COUNT directories"
	wait
}

delete_files () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] deleting files..."
	local PATTERN LOOP_COUNT=0 FILE_COUNT=0

	for PATTERN in "${FILE_PATTERNS[@]}"; do
		LOOP_COUNT=$(find . -type f -name "$PATTERN" | wc -l)
		[ "$LOOP_COUNT" = "0" ] && continue
		echo "delete PATTERN=$PATTERN (LOOP_COUNT=$LOOP_COUNT)"
		FILE_COUNT=$((FILE_COUNT+LOOP_COUNT))
		find . -type f -name "$PATTERN" -delete &
	done

	for PATTERN in "${TEST_PROJECT_PATTERNS[@]}"; do
		LOOP_COUNT=$(find . -type f -name "$PATTERN" | wc -l)
		[ "$LOOP_COUNT" = "0" ] && continue
		echo "delete TEST_PROJECT_PATTERN=test_projects/$PATTERN (LOOP_COUNT=$LOOP_COUNT)"
		FILE_COUNT=$((FILE_COUNT+LOOP_COUNT))
		find test_projects -type f -name "$PATTERN" -delete &
	done

	echo "deleted $FILE_COUNT files"
	wait
}

########## MAIN BLOCK ##########
main_block "$@"
