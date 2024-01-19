# Versioning

---

## Structure

`major.minor.patch`
`major.minor.patch[+build]`

### Major

### Minor

* odd = pre-release
* even = release

### Patch

* odd = pre-release
* even = release
* <num>b = beta/not published

## Scripts / Commands

This script bumps the version and update the necessary files.

```bash
scripts/update_version.sh
scripts/update_version.sh --pre-release ## append the $CIRCLE_BUILD_NUM to the current tag
scripts/update_version.sh --version patch ## bump the patch version
scripts/update_version.sh -v minor ## bump the minor version
```
