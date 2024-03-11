#!/bin/bash
set -eou pipefail

ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj0 npm test
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj3 npm test
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj2 npm test:coverage
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj3 npm test -- --coverage
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj4,proj5 npm test
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj6,proj7A npm test:coveragej5
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj8,proj9 npm test:coverage
ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj8,proj9 npm test -- --coverage

docker/run_tests.sh -p proj6
docker/run_tests.sh -p proj7 -o 12.7.0
docker/run_tests.sh -p proj8,proj9 -o 12.2.12 -v stable
docker/run_tests.sh -p proj10 -o 12.2.12 -v insiders

npm test
docker/run_tests.sh
