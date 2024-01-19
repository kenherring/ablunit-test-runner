# Docker

This extension is tested in the CI/CD pipelines by leveraging docker containers.  There is potential to reduce the duplicativeness of these tests.  Beware that this will likely impact their future use cases.

## Scripts

The following scripts build and run tests within a docker container, just as in the CI/CD pipeline.

* `docker/docker_build.sh` - create the testing container
* `docker/run_tests.sh` - run tests in the testing container.  This script has various options:
    * `docker/run_tests.sh -h` - display all available options
    * `docker/run_tests.sh -i` - package the extension, install it to vscode, and run tests
    * `docker/run_tests.sh -p proj1` - run tests for a single test project
    * `ABLUNIT_TEST_RUNNER_PROJECT_NAME=proj1 docker/run_tests.sh` - run tests for a single test project
