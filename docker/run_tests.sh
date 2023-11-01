#!/bin/bash
set -eou pipefail

GIT_BRANCH=$(git branch --show-current)

docker run --rm kherring/ablunit-test-runner bash -c "set -eou pipefail;
	echo 'starting tests...'; \
	git clone https://github.com/kenherring/ablunit-test-provider .; \
	git checkout '"$GIT_BRANCH"'; \
	npm install; \
	npm run compile; \
	sudo chmod +x /psc/dlc/bin/_progres; \
	sudo service dbus start; \
	xvfb-run -a npm run test; \
	echo 'done running tests'"
