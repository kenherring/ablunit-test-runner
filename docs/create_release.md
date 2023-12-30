# Create Release Notes

This could and will be automated at some point, but for now this doc tracks what needs to be done.

## Steps

* Update [`CHANGELOG.md`](../CHANGELOG.md) with the new version number, date, and release notes
* Update [`package.json`](../package.json) with the new version number
  * Odd minor version numbers are pre-release, even numbers are stable.  Ex: `0.1.0` is pre-release, `0.2.0` is stable
* Create a [release](https://github.com/kenherring/ablunit-test-provider/releases) in GitHub
