#!/bin/bash
set -eou pipefail

## initialize
GIT_BRANCH=$(git branch --show-current)
PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
PWD=$(pwd -W 2>/dev/null || pwd)
export GIT_BRANCH PROGRESS_CFG_BASE64

## create volume for .vscode-test directory to persist vscode application downloads
docker volume create --name vscode-test

## run tests inside the container
docker run --rm -it -e PROGRESS_CFG_BASE64 -e GIT_BRANCH \
	-v "$PWD":/home/circleci/ablunit-test-provider \
	-v vscode-test:/home/circleci/project/.vscode-test \
	kherring/ablunit-test-runner:latest \
	bash -c "/home/circleci/ablunit-test-provider/docker/entrypoint.sh;"
