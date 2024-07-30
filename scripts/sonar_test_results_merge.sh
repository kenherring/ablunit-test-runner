#!/bin/bash
set -eou pipefail
set -x

rm artifacts/mocha_results_sonar/merged.xml

for F in artifacts/mocha_results_sonar/*.xml; do
    echo "F=$F"
    if [ ! -f "$F.orig" ]; then
        cp "$F" "$F.orig"
    else
        cp "$F.orig" "$F"
    fi
    xq . "$F" -ix
    # xq . --xml-output "$F" > artifacts/mocha_results_sonar/$(basename "$F" .xml).formatted
done

{
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<testExecutions version="1">'
    cat artifacts/mocha_results_sonar/*.xml | grep -v '</*testExecutions'
    echo '</testExecutions>'
} > artifacts/mocha_results_sonar/merged
mv artifacts/mocha_results_sonar/merged artifacts/mocha_results_sonar/merged.xml

${CIRCLECI:-false} && sed -i "s|/home/circleci/project|$(pwd)|g" artifacts/eslint_report.json
cat artifacts/mocha_results_sonar/merged.xml
