# Create Release Notes

## Steps

* Update [`CHANGELOG.md`](../CHANGELOG.md) with the new version number, date, and release notes
* Update [`package.json`](../package.json) with the new version number
  * `npm version patch` will increment the patch number
  * Odd minor version and patch numbers are pre-release, even numbers are stable.  Odd minor/patch numbers will no longer be released to the marketplace.
    * Ex: `0.1.0` is pre-release, `0.2.0` is stable
    * Ex: `1.2.1` is pre-releace, `1.3.1` is pre-release, `1.4.1` is prerelease, `1.4.2` is stable
* Create a [release](https://github.com/kenherring/ablunit-test-provider/releases) in GitHub
  * This kicks off a build in CircleCI, which will publish to the marketplace.
