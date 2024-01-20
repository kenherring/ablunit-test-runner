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
npm version patch -m "v%s"
npm version minor -m "v%s"
```
