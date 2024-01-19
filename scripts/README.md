# Non-docker scripts

These scripts have various funcionality mostly related to repo config and testing.

## Non-docker scripts

The following scripts run tests locally, without docker, but do basically the same thing.  This makes for easy debugging while simultaneously confirming that functionality via windows is the same as linux.

* `scripts/clean.sh` - same as `npm run clean`
* `test_projects/setup.sh` - same as `npm run pretest`
    * calls `scripts/clean.sh`
* `scripts/install_and_run.sh` - non-docker version of `docker/run_tests.sh -i`
* `scripts/update_version.sh` - see [./docs/versioning.md](./docs/versioning.md)
