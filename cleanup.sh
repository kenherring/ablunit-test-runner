#!/bin/bash
set -eou pipefail

DELETE='-delete'

ARR=("ablunit.json" "progress.ini" "prof.out" "prof.json" "protrace.*" "results.json" "results.xml" "dbg_*" "*.xref" "results.prof" "profiler.json" "profile.options")

for F in "${ARR[@]}"; do
	echo "deleting $F"
	find test_projects -name "$F" -type f $DELETE
done

echo "deleting 'listings' directories"
find . -type d -name 'listings' -exec rm -rv {} +

rm -rf artifacts/ coverage/

echo "done cleanup"
