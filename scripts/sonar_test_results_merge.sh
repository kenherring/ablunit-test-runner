#!/bin/bash
set -eou pipefail

rm -f artifacts/mocha_results_sonar/merged.xml

if ! find artifacts/mocha_results_sonar -type f -name "*.xml"; then
    echo "ERROR: no *.xml files found in artifacts/mocha_results_sonar"
    exit 1
else
    echo "Directory is empty"
fi

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

${VERBOSE:-false} && cat artifacts/mocha_results_sonar/merged.xml

echo "successfully merged test results for sonar consumption.  output: artifacts/mocha_results_sonar/merged.xml"
