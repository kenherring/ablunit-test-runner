#!/bin/bash
set -eou pipefail

ARR=("ablunit.json" "ablunit.log" "progress.ini" "prof.out" "prof.json" "protrace.*" "results.json"
	 "results.xml" "dbg_*" "*.xref" "results.prof" "profiler.json" "profile.options")
for F in "${ARR[@]}"; do
	echo "deleting files matching '$F'"
	find test_projects -type f -name "$F" -delete
done

ARR=("listings" ".builder" "build" "ablunit-output")
for D in "${ARR[@]}"; do
	echo "deleting directories matching '$D'"
	find test_projects -type d -name "$D" -exec rm -rv {} + || true
done

echo "deleting artifacts and coverage directory"
rm -rf artifacts/ coverage/ C:/temp/ablunit/

echo "deleting storage directory kherring.ablunit-test-provider"
find . -type d -name "kherring.ablunit-test-provider" -exec rm -rv {} +

echo "cleanup complete"
