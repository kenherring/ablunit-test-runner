#!/bin/bash
set -eou pipefail

GIT_BRANCH=$(git branch --show-current)
PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
export GIT_BRANCH PROGRESS_CFG_BASE64

./cleanup.sh

	# -v "c:\git\ablunit-test-provider\.vscode-test-docker\:/home/circleci/project/.vscode-test" \
docker run --rm -it -e PROGRESS_CFG_BASE64 -e GIT_BRANCH \
	-v "c:\git\ablunit-test-provider\:/home/circleci/ablunit-test-provider" \
	kherring/ablunit-test-runner \
	bash -c "set -eou pipefail; \
	echo 'copying files'; \
	cd /home/circleci/ablunit-test-provider; \
	rsync -arv --exclude={'.git','.vscode-test','.vscode-test-docker','artifacts','coverage','node_modules','out'} . /home/circleci/project; \
	cd /home/circleci/project; \
	ls -al; \
	echo 'starting tests...'; \
	tr ' ' '\n' <<< \"\$PROGRESS_CFG_BASE64\" | base64 --decode > /psc/dlc/progress.cfg; \
	npm install; \
	npm run compile; \
	sudo service dbus start; \
	xvfb-run -a npm run test; \
	[ -f artifacts/mocha_results.xml ] || exit 1; \
	echo 'done running tests';
	"
