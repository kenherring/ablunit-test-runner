#!/bin/bash
set -eou pipefail
# set +x
set -x

VERBOSE=${VERBOSE:-false}

rm -f artifacts/mocha_results_sonar/merged.xml

if ! find artifacts/mocha_results_sonar -type f -name "*.xml" &> /dev/null; then
    echo "ERROR: no *.xml files found in artifacts/mocha_results_sonar" >&2
    exit 1
fi

for F in artifacts/mocha_results_sonar/*.xml; do
    $VERBOSE && echo "F=$F"
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
xq '.' artifacts/mocha_results_sonar/merged.xml > artifacts/mocha_results_sonar/merged.json

## TODO - print totals for pass, skipped, failed, etc
# FILE_COUNT="$(jq '.testExecutions.file[] | ."@path"' artifacts/mocha_results_sonar/merged.json  | wc -l)"
# TEST_COUNT=-1
# SKIPPED_COUNT=$(xq '.testExecutions.file[].testCase[] | select(.skipped != null) | ."@name"' artifacts/mocha_results_sonar/merged.xml | wc -l)
# ERROR_COUNT=-1

# echo "ERROR TESTS: TBD"

# ${CIRCLECI:-false} && sed -i "s|/home/circleci/project|$(pwd)|g" artifacts/eslint_report.json

if $VERBOSE; then
  echo "--------- 📁 artifacts/mpocha_results_sonar/merged.xml 📁 ----------"
  cat artifacts/mocha_results_sonar/merged.xml
  echo "----------   -----------------------------------------   ----------"
fi
echo "successfully merged test results for sonar consumption.  output: artifacts/mocha_results_sonar/merged.xml"
