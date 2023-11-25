#!/bin/sh

validate_version_updated() {
	PACKAGE_VERSION=$(jq -r '.version' package.json)
	TAG_VERSION=$(git tag | tail -1)
	SONAR_PROJECT_VERSION=$(grep -E '^sonar.projectVersion=' sonar-project.properties | cut -d'=' -f2)

	if [ "$PACKAGE_VERSION" = "$TAG_VERSION" ]; then
		echo "package.json version ($PACKAGE_VERSION) matches latest git tag ($TAG_VERSION) and should be updated" >&2
		exit 1
	fi
	if [ "$PACKAGE_VERSION" != "$SONAR_PROJECT_VERSION" ]; then
		echo "package.json version ($PACKAGE_VERSION) does not match 'sonar.projectVersion' ($SONAR_PROJECT_VERSION) in sonar-project.properties" >&2
		exit 1
	fi
}
