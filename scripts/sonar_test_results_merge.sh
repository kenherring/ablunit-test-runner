#!/bin/bash
set -eou pipefail

initialize () {
    rm -f artifacts/mocha_results_sonar/merged*.xml
    if ! find artifacts/mocha_results_sonar -type f -name "*.xml"; then
        echo "ERROR: no *.xml files found in artifacts/mocha_results_sonar"
        exit 1
    else
        echo "Directory is empty"
    fi
}

convert_and_merge_xml () {
    {
        echo '<?xml version="1.0" encoding="UTF-8"?>'
        echo '<testExecutions version="1">'
        cat artifacts/mocha_results_sonar/*.xml | grep -v '</*testExecutions'
        echo '</testExecutions>'
    } > artifacts/mocha_results_sonar/merged

    sed -i 's,<skipped></skipped>,<skipped/>,g' artifacts/mocha_results_sonar/merged
    sed -i 's,<skipped/>,<skipped message="skipped"/>,g' artifacts/mocha_results_sonar/merged

    mv artifacts/mocha_results_sonar/merged artifacts/mocha_results_sonar/merged.xml
    xq '.' artifacts/mocha_results_sonar/merged.xml > artifacts/mocha_results_sonar/merged.json

    ${VERBOSE:-false} && cat artifacts/mocha_results_sonar/merged.xml

    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] merged test results for sonar consumption.  output: artifacts/mocha_results_sonar/merged.xml"

}

show_summary () {
    jq '[ .testExecutions
            | .file     | if type=="array" then .[] else . end
            | .testCase | if type=="array" then .[] else . end
        ]' artifacts/mocha_results_sonar/merged.json > artifacts/mocha_results_sonar/merged_flat.json

    TEST_COUNT="$(jq '. | length' < artifacts/mocha_results_sonar/merged_flat.json)"
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] $TEST_COUNT total tests"

    SKIP_COUNT="$(jq '.[] | select(has("skipped")) | length' < artifacts/mocha_results_sonar/merged_flat.json || echo 0)"
    [ "$SKIP_COUNT" = "" ] && SKIP_COUNT=0
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] $SKIP_COUNT/$TEST_COUNT tests skipped"

    FAILURE_COUNT="$(jq '.[] | select(has("failure")) | length' < artifacts/mocha_results_sonar/merged_flat.json)"
    [ "$FAILURE_COUNT" = "" ] && FAILURE_COUNT=0
    echo "[$(date +%Y-%m-%d:%H:%M:%S) $0 ${FUNCNAME[0]}] ERROR: $FAILURE_COUNT/$TEST_COUNT tests failed"

    if [ "$FAILURE_COUNT" != "0" ]; then
        jq '.[] | select(has("failure"))' < artifacts/mocha_results_sonar/merged_flat.json
    fi
}


for F in artifacts/mocha_results_sonar/*.xml; do
    echo "F=$F"
    if [ ! -f "$F.orig" ]; then
        cp "$F" "$F.orig"
    else
        cp "$F.orig" "$F"
    fi
    xq . "$F" -ix
    xq . "$F" > "artifacts/mocha_results_sonar/$(basename "$F" .xml).json"
done

########## MAIN BLOCK ##########
initialize
convert_and_merge_xml
show_summary
