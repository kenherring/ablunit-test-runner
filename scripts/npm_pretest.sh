#!/bin/bash
set -euo pipefail

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	PATH=$PATH:$DLC/ant/bin
	CIRCLECI=${CIRCLECI:-false}
	NO_BUILD=${NO_BUILD:-false}
	VERBOSE=${VERBOSE:-false}
	WSL=false
	VERBOSE=${VERBOSE:-false}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-12.2.12}
	${CIRCLECI:-false} && NO_BUILD=true
	[ -z "${DOCKER_IMAGE:-}" ] && NO_BUILD=true
	[ -z "${WSL_DISTRO_NAME:-}" ] && WSL=true
	PACKAGE_VERSION=$(node -p "require('./package.json').version")

	while getopts 'hNoVv' OPT; do
		case "$OPT" in
			N)	NO_BUILD=true ;;
			o)	ABLUNIT_TEST_RUNNER_OE_VERSION="$OPTARG" ;;
			v)	VERBOSE=true ;;
			?)	echo "script usage: $(basename "$0") [-h] [-N]" >&2
				exit 1 ;;
		esac
	done

	export PATH CIRCLECI ABLUNIT_TEST_RUNNER_OE_VERSION

	if [ ! -d node_modules ]; then
		npm install
	fi
}

# load lots of code for a performance test
get_performance_test_code () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd) ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"

	local TO_FILE="/home/circleci/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz"
	if [ "${OS:-}" = "Windows_NT" ] || [ -n "${WSL_DISTRO_NAME:-}" ]; then
		mkdir -p .vscode-test
		TO_FILE=.vscode-test/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz
	fi
	if [ ! -f "$TO_FILE" ]; then
		if [ -n "${DOCKER_IMAGE:-}" ]; then
			echo "ERROR: cannot find file '$TO_FILE'"
			echo " - HINT: this should have been fetched during docker build"
		else
			curl -L "https://github.com/progress/ADE/archive/refs/tags/v${ABLUNIT_TEST_RUNNER_OE_VERSION}.0.tar.gz" -o "$TO_FILE"
		fi
	fi
	tar -xf "$TO_FILE" -C test_projects/proj7_load_performance/src
}

get_pct () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	if $WSL && [ ! -f ~/.ant/lib/PCT.jar ]; then
		mkdir -p ~/.ant/lib
		local ARGS=()
		ARGS+=(-L)
		ARGS+=(-o ~/.ant/lib/PCT.jar)
		$VERBOSE && ARGS+=(-v)
		curl "${ARGS[@]}" https://github.com/Riverside-Software/pct/releases/download/v228/PCT.jar
	fi
}

create_dbs () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	if [ -d test_projects/proj0/target/db ]; then
		return 0
	fi

	local COMMAND=ant
	cd test_projects/proj0
	COMMAND=ant
	if ! command -v $COMMAND; then
		COMMAND="$DLC/ant/bin/ant"
	fi
	mkdir -p artifacts
	$COMMAND > artifacts/pretest_ant.log >&1
	cd -
}

doPackage () {
	$NO_BUILD && return 0
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"

	local PACKAGE_OUT_OF_DATE=false
	local VSIX_COUNT=0
	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	echo "VSIX_COUNT=$VSIX_COUNT"

	if [ -f "ablunit-test-runner-$PACKAGE_VERSION.vsix" ]; then
		NEWEST_SOURCE=$(find src -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
		NEWEST_SOURCE_TEST=$(find test -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
		NEWEST_SOURCE_ROOT=$(find . -maxdepth 1 -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

		if $VERBOSE; then
			echo "recent source files:"
			ls -altr "$NEWEST_SOURCE" "$NEWEST_SOURCE_TEST" "$NEWEST_SOURCE_ROOT" "ablunit-test-runner-$PACKAGE_VERSION.vsix"
		fi

		[ "$NEWEST_SOURCE_TEST" -nt "$NEWEST_SOURCE" ] && NEWEST_SOURCE=$NEWEST_SOURCE_TEST
		[ "$NEWEST_SOURCE_ROOT" -nt "$NEWEST_SOURCE" ] && NEWEST_SOURCE=$NEWEST_SOURCE_ROOT

		if  [ "$NEWEST_SOURCE" -nt "ablunit-test-runner-$PACKAGE_VERSION.vsix" ]; then
			echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] newer source file found: $NEWEST_SOURCE"
			PACKAGE_OUT_OF_DATE=true
		fi
	else
		PACKAGE_OUT_OF_DATE=true
	fi
	echo "CIRCLECI=$CIRCLECI PACKAGE_OUT_OF_DATE=$PACKAGE_OUT_OF_DATE VSIX_COUNT=$VSIX_COUNT"
	if $PACKAGE_OUT_OF_DATE || $CIRCLECI || [ "$VSIX_COUNT" = "0" ]; then
		.circleci/package.sh
	fi

	VSIX_COUNT=$(find . -maxdepth 1 -name "*.vsix" 2>/dev/null | wc -l)
	if [ "$VSIX_COUNT" = "0" ]; then
		echo "ERROR: no .vsix files found"
		exit 1
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
get_performance_test_code
get_pct
create_dbs
doPackage
rm -rf artifacts coverage
echo "[$0] completed successfully!"
