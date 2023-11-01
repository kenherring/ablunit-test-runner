#!/bin/bash
set -eou pipefail

GIT_BRANCH=$(git branch --show-current)
PROGRESS_CFG_BASE64=$(base64 "$DLC/progress.cfg" | tr '\n' ' ')
export GIT_BRANCH PROGRESS_CFG_BASE64

docker run --rm -it -e PROGRESS_CFG_BASE64 -e GIT_BRANCH \
	kherring/ablunit-test-runner \
	bash -c "set -eou pipefail; \
	echo 'starting tests...'; \
	git clone https://github.com/kenherring/ablunit-test-provider .; \
	git checkout \"\$GIT_BRANCH\"; \
	npm install; \
	npm run compile; \
	tr ' ' '\n' <<< \"\$PROGRESS_CFG_BASE64\" | base64 --decode > /psc/dlc/progress.cfg; \
	sudo service dbus start; \
	xvfb-run -a npm run test; \
	[ -f artifacts/mocha_results.xml ] || exit 1; \
	echo 'done running tests';
	"
