#!/bin/bash
set -eou pipefail

cp /c/Progress/OpenEdge/tty/ablunit.pl docker/ablunit.pl

docker build -f docker/Dockerfile -t kherring/ablunit-test-runner .

# docker push kherring/ablunit-test-runner
