# Docker

This extension is tested in the CI/CD pipelines by leveraging docker containers.

## Scripts

* `docker/docker_build.sh` - create the testing container
* `docker/docker_run.sh` - run development tests in the container
* `docker/docker_run.sh -i` - package the extension, install it to vscode, and run tests
* `docker/docker_run.sh -h` - display all available options
