#!/bin/bash
set -eou pipefail

echo "starting lint..."
npx eslint . --ext .ts,.js -f json | jq '.' > artifacts/eslint_plain_report.json
npx eslint . --ext .ts,.js -f .circleci/sonarqube_formatter.js | jq '.' > artifacts/eslint_report.json
npx eslint . --ext .ts,.js -f junit -o artifacts/eslint.xml
