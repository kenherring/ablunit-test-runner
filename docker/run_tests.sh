#!/bin/bash
set -eou pipefail

## initialize
GIT_BRANCH=$(git branch --show-current)
PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
PWD=$(pwd -W 2>/dev/null || pwd)
export GIT_BRANCH PROGRESS_CFG_BASE64

## create volume for .vscode-test directory to persist vscode application downloads
docker volume create --name vscode-test

OPTS=
if [ "${1:-}" = "-b" ]; then
	OPTS='-b'
fi

if [ -z "${DOCKER_TAG:-}" ]; then
	DOCKER_TAG=latest
fi

## run tests inside the container
docker run --rm -it -e PROGRESS_CFG_BASE64 -e GIT_BRANCH \
	-v "$PWD":/home/circleci/ablunit-test-provider \
	-v vscode-test:/home/circleci/project/.vscode-test \
	-v node-modules:/home/circleci/project/node_modules \
	kherring/ablunit-test-runner:"$DOCKER_TAG" \
	bash -c "/home/circleci/ablunit-test-provider/docker/entrypoint.sh $OPTS;"
