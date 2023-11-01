#!/bin/bash
set -eou pipefail

docker build -f docker/Dockerfile -t kherring/ablunit-test-runner .

# docker push kherring/ablunit-test-runner
