#!/bin/bash
set -eou pipefail

echo "starting lint..."
if ! npx eslint . --ext .ts,.js; then
	echo "eslint failed"
fi
if ! npx eslint . --ext .ts,.js -f json | jq '.' > artifacts/eslint_plain_report.json; then
	echo "eslint plain failed"
fi
if ! npx eslint . --ext .ts,.js -f .circleci/sonarqube_formatter.js | jq '.' > artifacts/eslint_sonar_report.json; then
	echo "eslint sonar failed"
fi
if ! npx eslint . --ext .ts,.js -f junit -o artifacts/eslint.xml; then
	echo "eslint junit failed"
fi
