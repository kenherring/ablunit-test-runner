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

```
scripts/update_version.sh
scripts/update_version.sh --pre-release
scripts/update_version.sh --version patch
scripts/update_version.sh -v minor
```

```
rm -rf out node_modules .vscode-test ;
CIRCLE_BUILD_NUM=15 scripts/update_version.sh --pre-release ;
scripts/install_and_run.sh ;
```
