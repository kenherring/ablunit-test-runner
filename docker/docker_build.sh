#!/bin/bash
set -eou pipefail

if [ -z "$DLC" ]; then
	echo "ERROR: DLC environment variable not set... exiting"
	exit 1
fi

cp "$DLC/tty/ablunit.pl" docker/ablunit.pl

docker build -f docker/Dockerfile -t kherring/ablunit-test-runner .

# docker push kherring/ablunit-test-runner
