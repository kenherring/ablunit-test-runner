#!/bin/bash
set -euo pipefail

usage () {
	echo "
usage: $0 [ -o (12.2.12 | 12.7.0 | all) ] [ -V (stable | proposedapi | insiders)] [ -p <project_name> ] [-bBimPv]
options:
  -o <version>  OE version (default: 12.2.12)
  -V <version>  VSCode version (default: stable)
  -b            drop to bash shell inside container on failure
  -B            same as -b, but only on error
  -C            delete cache volume before running tests
  -i            run install and run test
  -m            copy modified files and staged files
  -P            package extension
  -p <project>  run tests for a specific test project
                alternative: set the  ABLUNIT_TEST_RUNNER_PROJECT_NAME environment variable
  -v            verbose
  -h            show this help message and exit
" >&2
}

initialize () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	OPTS=
	SCRIPT=entrypoint
	DELETE_CACHE_VOLUME=false
	TEST_PROJECT=base
	STAGED_ONLY=true
	local OE_VERSION=12.2.12
	ABLUNIT_TEST_RUNNER_VSCODE_VERSION=stable
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}

	while getopts "bBCdimso:p:PvV:h" OPT; do
		case $OPT in
			o)	OE_VERSION=$OPTARG ;;
			b)	OPTS='-b' ;;
			B)  OPTS='-B' ;;
			C)	DELETE_CACHE_VOLUME=true ;;
			i)	TEST_PROJECT=dummy-ext ;;
			m)	STAGED_ONLY=false ;;
			h)	usage && exit 0 ;;
			P)	CREATE_PACKAGE=true ;;
			p)	ABLUNIT_TEST_RUNNER_PROJECT_NAME=$OPTARG ;;
			v)	VERBOSE=true ;;
			V)	ABLUNIT_TEST_RUNNER_VSCODE_VERSION=$OPTARG ;;
			?)	usage && exit 1 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done
	shift $((OPTIND - 1))
	if [ -n "${1:-}" ]; then
		echo "Error: extra parameter(s) found: $*" >&2
		usage && exit 1
	fi

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME//\\/\/}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME//*\/}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME//.test.ts}

	if  [ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != 'stable' ] &&
		[ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != 'proposedapi' ] &&
		[ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != 'insiders' ]; then
		echo "ERROR: Invalid VSCode version: $ABLUNIT_TEST_RUNNER_VSCODE_VERSION" >&2
		usage && exit 1
	fi

	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY OE_VERSION TEST_PROJECT CREATE_PACKAGE VERBOSE
	export ABLUNIT_TEST_RUNNER_PROJECT_NAME ABLUNIT_TEST_RUNNER_VSCODE_VERSION

	if $DELETE_CACHE_VOLUME; then
		echo "deleting test-runner-cache volume"
		docker volume rm test-runner-cache
	fi

	## create volume for .vscode-test directory to persist vscode application downloads
	if ! docker volume ls | grep -q test-runner-cache; then
		echo "creating test-runner-cache volume"
		docker volume create --name test-runner-cache
	fi

	if [ "${OE_VERSION,,}" = "all" ]; then
		OE_VERSIONS=(12.2.12 12.7.0)
	elif [ "$OE_VERSION" != "12.2.12" ] && [ "$OE_VERSION" != "12.7.0" ]; then
		echo "Invalid OE version: $OE_VERSION" >&2
		usage && exit 1
	else
		# shellcheck disable=SC2178
		OE_VERSIONS=${OE_VERSION,,}
		# shellcheck disable=SC2206
		OE_VERSIONS=(${OE_VERSIONS//,/ })
	fi

	mkdir -p docker/artifacts
}

run_tests_in_docker () {
	echo "[$0 ${FUNCNAME[0]}] pwd=$(pwd)"
	local OE_VERSION

	for OE_VERSION in "${OE_VERSIONS[@]}"; do
		echo "[$0 ${FUNCNAME[0]}] docker run with OE_VERSION=$OE_VERSION"
		export OE_VERSION
		local ARGS=(
			--rm
			-it
			-e PROGRESS_CFG_BASE64
			-e GIT_BRANCH
			-e STAGED_ONLY
			-e OE_VERSION
			-e TEST_PROJECT
			-e CREATE_PACKAGE
			-e VERBOSE
			-e ABLUNIT_TEST_RUNNER_VSCODE_VERSION
			-v "$PWD/docker/artifacts":/home/circleci/artifacts
		)
		[ -n "$ABLUNIT_TEST_RUNNER_PROJECT_NAME" ] && ARGS+=(-e ABLUNIT_TEST_RUNNER_PROJECT_NAME)
		ARGS+=(
			-v "$PWD":/home/circleci/ablunit-test-runner:ro
			-v test-runner-cache:/home/circleci/cache
			kherring/ablunit-test-runner:"$OE_VERSION"
			bash -c "/home/circleci/ablunit-test-runner/docker/$SCRIPT.sh $OPTS;"
		)
		## run tests inside the container
		docker run "${ARGS[@]}"
		echo "tests completed successfully with OE_VERSION=$OE_VERSION"
	done
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "[$0] completed successfully! (script=docker/$SCRIPT.sh)"
