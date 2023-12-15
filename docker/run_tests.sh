#!/bin/bash
set -eou pipefail

initialize () {
	OPTS=
	SCRIPT=entrypoint
	STAGED_ONLY=false
	VSCODE_DIR=/home/circleci/project/.vscode-test

	while getopts "bis" OPT; do
		case $OPT in
			b)	OPTS='-b' ;;
			i)	SCRIPT=install_and_run ;;
			s)	STAGED_ONLY=true ;;
			\?)	echo "Invalid option: -$OPTARG" >&2 && exit 1 ;;
		esac
	done
	if [ "${1:-}" = "-b" ]; then
		OPTS='-b'
	elif [ "${1:-}" = "install-and-run" ] || [ "${1:-}" = "install_and_run" ]; then
		SCRIPT=install_and_run
		VSCODE_DIR=/home/circleci/project/dummy-ext/.vscode-test
	elif [ -n "${1:-}" ]; then
		echo "Invalid option: $1" >&2 && exit 1
	fi

	GIT_BRANCH=$(git branch --show-current)
	PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
	PWD=$(pwd -W 2>/dev/null || pwd)
	export GIT_BRANCH PROGRESS_CFG_BASE64 STAGED_ONLY

	## create volume for .vscode-test directory to persist vscode application downloads
	# docker volume create --name vscode-test
	# docker volume create --name node-modules

	if [ -z "${DOCKER_TAG:-}" ]; then
		DOCKER_TAG=latest
	fi
}

run_tests_in_docker () {
	## run tests inside the container
	echo "starting 'docker run' [script=docker/$SCRIPT.sh]..."
	time docker run --rm -it -e PROGRESS_CFG_BASE64 -e GIT_BRANCH -e STAGED_ONLY \
		-v "$PWD":/home/circleci/ablunit-test-provider \
		-v vscode-test:$VSCODE_DIR \
		-v node-modules:/home/circleci/project/node_modules \
		kherring/ablunit-test-runner:"$DOCKER_TAG" \
		bash -c "/home/circleci/ablunit-test-provider/docker/$SCRIPT.sh $OPTS;"
	echo "'docker run' completed successfully! [script=docker/$SCRIPT.sh]"
}

########## MAIN BLOCK ##########
initialize "$@"
run_tests_in_docker
