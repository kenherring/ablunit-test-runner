#!/bin/bash
set -eou pipefail

GIT_BRANCH=$(git branch --show-current)
PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
export GIT_BRANCH PROGRESS_CFG_BASE64

./cleanup.sh

docker volume create --name vscode-test

set -x
docker run --rm -it -e PROGRESS_CFG_BASE64 -e GIT_BRANCH \
	-v "$(pwd)":/home/circleci/ablunit-test-provider \
	-v vscode-test:/home/circleci/project/.vscode-test \
	kherring/ablunit-test-runner \
	bash -c "/home/circleci/ablunit-test-provider/docker/entrypoint.sh;"
