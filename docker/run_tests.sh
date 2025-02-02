#!/bin/bash
set -eou pipefail

usage () {
	echo "
usage: $0 [ -o (12.2.12 | 12.7.0 | 12.8.1 | 12.8.3 | 12.8.4 | 12.8.5 | all) ] [ -V (stable | proposedapi | insiders | X.Y.Z] )] [ -p <project_name> ] [-bBimPv]
options:
  -o <version>  OE version (default: 12.8.1)
                alternative: set the ABLUNIT_TEST_RUNNER_OE_VERSION environment variable
  -V <version>  VSCode version (default: stable)
                alternative: set the ABLUNIT_TEST_RUNNER_VSCODE_VERSION environment variable
  -b            drop to bash shell inside container on failure
  -B            same as -b, but only on error
  -C | -d       delete volumes 'vscode-cli-cache' and 'test-runner-cache' before running tests
  -i            run install and run test
  -m            copy modified files and staged files
  -n            run tests without coverage
  -P            package extension
  -p <project>  run tests for a specific test project
                alternative: set the  ABLUNIT_TEST_RUNNER_PROJECT_NAME environment variable
  -g <pattern>  test grep pattern
  -v            verbose
  -h            show this help message and exit
" >&2
}

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd)"
	OPTS=
	SCRIPT=entrypoint
	DELETE_CACHE_VOLUME=false
	TEST_PROJECT=base
	STAGED_ONLY=true
	ABLUNIT_TEST_RUNNER_DBUS_NUM=${ABLUNIT_TEST_RUNNER_DBUS_NUM:-3}
	ABLUNIT_TEST_RUNNER_OE_VERSION=${ABLUNIT_TEST_RUNNER_OE_VERSION:-}
	ABLUNIT_TEST_RUNNER_VSCODE_VERSION=${ABLUNIT_TEST_RUNNER_VSCODE_VERSION:-stable}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-${PROJECT_NAME:-}}
	ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG=${ABLUNIT_TEST_RUNNER_RUN_SCRIPT_FLAG:-true}

	while getopts "bBCdimnsxo:p:PvV:h" OPT; do
		case $OPT in
			o)	ABLUNIT_TEST_RUNNER_OE_VERSION=$OPTARG ;;
			b)	OPTS='-b' ;;
			B)  OPTS='-B' ;;
			C)	DELETE_CACHE_VOLUME=true ;;
			d)  DELETE_CACHE_VOLUME=true ;;
			i)	TEST_PROJECT=dummy-ext ;;
			m)	STAGED_ONLY=false ;;
			h)	usage && exit 0 ;;
			P)	CREATE_PACKAGE=true ;;
			p)	ABLUNIT_TEST_RUNNER_PROJECT_NAME=$OPTARG ;;
			x)	OPTS='-x'
				set -x ;;
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

	if [ -z "$DLC" ]; then
		echo "ERROR: DLC environment variable is not set"
		exit 1
	fi

	if ${CIRCLECI:-false} && [ -z "$ABLUNIT_TEST_RUNNER_OE_VERSION" ]; then
		cat "$DLC/version"
		ABLUNIT_TEST_RUNNER_OE_VERSION=$(awk '{print $3}' < "$DLC/version")
		if [[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
			ABLUNIT_TEST_RUNNER_OE_VERSION="${ABLUNIT_TEST_RUNNER_OE_VERSION}.0"
		fi
	fi
	if [ -z "$ABLUNIT_TEST_RUNNER_OE_VERSION" ]; then
		ABLUNIT_TEST_RUNNER_OE_VERSION=12.8.1
	fi
	if [[ ! "$ABLUNIT_TEST_RUNNER_OE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		echo "ERROR: invalid ABLUNIT_TEST_RUNNER_OE_VERSION: '$ABLUNIT_TEST_RUNNER_OE_VERSION'"
		exit 1
	fi

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	PWD=${PWD//\//\\}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME//\\/\/}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME//*\/}
	ABLUNIT_TEST_RUNNER_PROJECT_NAME=${ABLUNIT_TEST_RUNNER_PROJECT_NAME//.test.ts}

	if  [ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != 'stable' ] &&
		[ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != 'proposedapi' ] &&
		[ "$ABLUNIT_TEST_RUNNER_VSCODE_VERSION" != 'insiders' ]; then
		echo "ERROR: Invalid VSCode version: $ABLUNIT_TEST_RUNNER_VSCODE_VERSION" >&2
		usage && exit 1
	fi

	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY TEST_PROJECT CREATE_PACKAGE VERBOSE
	export ABLUNIT_TEST_RUNNER_DBUS_NUM \
		ABLUNIT_TEST_RUNNER_PROJECT_NAME \
		ABLUNIT_TEST_RUNNER_OE_VERSION \
		ABLUNIT_TEST_RUNNER_VSCODE_VERSION


	if $DELETE_CACHE_VOLUME; then
		local VOLS=()
		docker volume ls | grep -q test-runner-cache && VOLS+=(test-runner-cache)
		docker volume ls | grep -q "vscode-cli-cache-$ABLUNIT_TEST_RUNNER_OE_VERSION" && VOLS=("vscode-cli-cache-$ABLUNIT_TEST_RUNNER_OE_VERSION")
		if [ ${#VOLS[@]} -eq 0 ]; then
			echo "no volumes to delete"
		else
			echo "deleting volume(s): ${VOLS[*]}"
			docker volume rm "${VOLS[@]}"
		fi
	fi

	## create volume for .vscode-test directory to persist vscode application downloads
	# if ! docker volume ls | grep -q test-runner-cache; then
	# 	echo "creating test-runner-cache volume"
	# 	docker volume create --name test-runner-cache
	# fi
	if ! docker volume ls | grep -q vscode-cli-cache; then
		echo "creating vscode-cli-cache"
		docker volume create --name vscode-cli-cache
	fi

	if [ "${ABLUNIT_TEST_RUNNER_OE_VERSION,,}" = "all" ]; then
		OE_VERSIONS=(12.2.12 12.7.0 12.8.1 12.8.3 12.8.4 12.8.5)
	elif [ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != '12.2.12' ] &&
		[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != '12.7.0' ] &&
		[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != '12.8.1' ] &&
		[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != '12.8.3' ] &&
		[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != '12.8.4' ] &&
		[ "$ABLUNIT_TEST_RUNNER_OE_VERSION" != '12.8.5' ]; then
		echo "Invalid OE version: $ABLUNIT_TEST_RUNNER_OE_VERSION" >&2
		usage && exit 1
	else
		# shellcheck disable=SC2178
		OE_VERSIONS=${ABLUNIT_TEST_RUNNER_OE_VERSION,,}
		# shellcheck disable=SC2206
		OE_VERSIONS=(${OE_VERSIONS//,/ })
	fi

	mkdir -p docker/artifacts
}

run_tests_in_docker () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] pwd=$(pwd) ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	local ABLUNIT_TEST_RUNNER_OE_VERSION

	for ABLUNIT_TEST_RUNNER_OE_VERSION in "${OE_VERSIONS[@]}"; do
		echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] docker run with ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
		export ABLUNIT_TEST_RUNNER_OE_VERSION ABLUNIT_TEST_RUNNER_VSCODE_VERSION ABLUNIT_TEST_RUNNER_PROJECT_PROJECT_NAME
		local ARGS=(
			--cpus=4 ## large resource class in CircleCI
			--memory=4g ## large resource class in CircleCI
			--gpus=0
			--rm
			-it
			-e PROGRESS_CFG_BASE64
			-e GIT_BRANCH
			-e STAGED_ONLY
			-e ABLUNIT_TEST_RUNNER_DBUS_CONFIG
			-e ABLUNIT_TEST_RUNNER_OE_VERSION
			-e TEST_PROJECT
			-e CREATE_PACKAGE
			-e VERBOSE
			-e ABLUNIT_TEST_RUNNER_VSCODE_VERSION
			-e SET_X
			-v "${PWD}/artifacts":/home/circleci/project/artifacts
			-v "${PWD}/coverage":/home/circleci/project/coverage
		)
		[ -n "${ABLUNIT_TEST_RUNNER_PROJECT_NAME:-}" ] && ARGS+=(-e ABLUNIT_TEST_RUNNER_PROJECT_NAME)
		ARGS+=(
			-v "${PWD}":/home/circleci/ablunit-test-runner:ro
			-v "vscode-cli-cache-$ABLUNIT_TEST_RUNNER_OE_VERSION":/home/circleci/project/.vscode-test
			kherring/ablunit-test-runner:"${ABLUNIT_TEST_RUNNER_OE_VERSION}"
			bash -c "/home/circleci/ablunit-test-runner/docker/$SCRIPT.sh $OPTS;"
		)
		## run tests inside the container
		docker run "${ARGS[@]}"
		echo "tests completed successfully with ABLUNIT_TEST_RUNNER_OE_VERSION=$ABLUNIT_TEST_RUNNER_OE_VERSION"
	done
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully! (script=docker/$SCRIPT.sh)"
