#!/bin/bash
set -eou pipefail

. scripts/common.sh

initialize () {
	echo "initialize"
	PACKAGE_VERSION=$(jq -r .version package.json)
	PREVIOUS_VERSION=$(grep -Eo '\[v[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | cut -dv -f2 | cut -d] -f1 | head -1)
	echo "PACKAGE_VERSION=$PACKAGE_VERSION PREVIOUS_VERSION=$PREVIOUS_VERSION"
}

update_changelog () {
	echo "update_changelog"
	MINOR=$(echo "$PACKAGE_VERSION" | awk -F. '{print $2}')

	PRE_RELEASE=
	echo "MINOR-modulo-1=$((MINOR % 1))" >&2
	if [ "$(( MINOR % 1 ))" = "0" ]; then
		PRE_RELEASE=" (pre-release)"
	fi

	rm "changelog_$PACKAGE_VERSION.md" 2>/dev/null || true
	{
		echo -e "# [v$PACKAGE_VERSION](https://github.com/kenherring/ablunit-test-runner/releases/tag/v$PACKAGE_VERSION) - $(date +%Y-%m-%d)$PRE_RELEASE\n"
		git log --pretty=format:' * %s' "v${PREVIOUS_VERSION}..HEAD"
		echo -e '\n'
		cat CHANGELOG.md
	} > "changelog_$PACKAGE_VERSION.md"

	rm CHANGELOG.md
	mv "changelog_$PACKAGE_VERSION.md" CHANGELOG.md
}

########## MAIN BLOCK ##########
initialize
update_changelog
echo "version updated to $PACKAGE_VERSION successfully!" >&2
