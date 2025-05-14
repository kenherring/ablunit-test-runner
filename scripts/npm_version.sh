#!/bin/bash
set -eou pipefail

. scripts/common.sh

usage () {
	local EXIT_CODE="${1:-0}"
	echo "usage: $0 [--pre-release | -p] [--help | -h]"
	echo "  --[p]re-release         create a pre-release package"
	echo "  --[v]ersion <version>   specify a version to use"
	echo "  --[h]elp                print this message"
	exit "$EXIT_CODE"
}

initialize () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}]"

	PRERELEASE=false
    PACKAGE_VERSION=$(node -p "require('./package.json').version")
	PREVIOUS_VERSION=$(grep -Eo '\[v?[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | cut -d[ -f2 | cut -d] -f1 | head -1)
	PREVIOUS_TAG=$(git tag | grep -v '^v' | grep "[0,2,4,6,8]$" | tail -1)
	CURRENT_PR_TEXT=$(CURRENT_PR_TEXT=$(gh pr view --json title,number | jq -r '.title + " (#" + (.number|tostring) + ")"'))

	if [ -z "$CURRENT_PR_TEXT" ]; then
		echo "ERROR: no current PR text found"
		exit 1
	fi

	if [ "$(git branch --show-current)" = "main" ]; then
		echo "ERROR: cannot be on main branch to run $0"
		exit 1
	fi

	PATCH=${PACKAGE_VERSION##*.}
	if [ "$((PATCH % 2))" = "1" ]; then
		PRERELEASE=true
	fi
}

update_version () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] PACKAGE_VERSION=$PACKAGE_VERSION"

	update_changelog
	if ! $PRERELEASE; then
		update_templates
	fi
	git add .
}

update_templates () {
	sed -i "s/$PREVIOUS_VERSION/$PACKAGE_VERSION\n        - $PREVIOUS_VERSION/g" .github/ISSUE_TEMPLATE/bug_report.yml
	sed -i "s/$PREVIOUS_VERSION/$PACKAGE_VERSION\n        - $PREVIOUS_VERSION/g" .github/ISSUE_TEMPLATE/question.yml
}

update_changelog () {
	echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] update CHANGELOG.md from $PREVIOUS_VERSION to $PACKAGE_VERSION"

	local PRERELEASE_TEXT=
	if $PRERELEASE; then
		PRERELEASE_TEXT=" (pre-release)"
	fi

	## delete all lines before the previous non-prerelease tag
	local HAS_TAG=false
	rm -f CHANGELOG.md.tmp
	while read -r LINE; do
		if [[ "$LINE" =~ ^#\ \[$PREVIOUS_TAG\] ]]; then
			HAS_TAG=true
		fi
		if $HAS_TAG; then
			echo "$LINE" >> CHANGELOG.md.tmp
		fi
	done < CHANGELOG.md
	mv CHANGELOG.md.tmp CHANGELOG.md

	## output a new changelog entry followed by the rest of the changelog
	rm "changelog_$PACKAGE_VERSION.md" 2>/dev/null || true
	{
		echo -e "# [${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/releases/tag/${PACKAGE_VERSION}) - $(date +%Y-%m-%d)${PRERELEASE_TEXT}\n"
		echo -e "\n * $CURRENT_PR_TEXT"
		git --no-pager log --pretty=format:' * %s' "${PREVIOUS_TAG}...$(git merge-base origin/main HEAD)"
		echo -e "\n\n**Full Changelog**: [${PREVIOUS_TAG}...${PACKAGE_VERSION}](https://github.com/kenherring/ablunit-test-runner/compare/${PREVIOUS_VERSION}...${PACKAGE_VERSION})\n"
		cat CHANGELOG.md
	} > "changelog_$PACKAGE_VERSION.md"

	mv "changelog_$PACKAGE_VERSION.md" CHANGELOG.md
	if ! ${CIRCLECI:-false}; then
		code --wait CHANGELOG.md
	fi
}

########## MAIN BLOCK ##########
initialize "$@"
update_version
echo "[$(date +%Y-%m-%d:%H:%M:%S) $0] completed successfully!"
