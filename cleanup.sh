#!/bin/bash

DELETE="-delete"

ARR=("ablunit.json" "progress.ini" "prof.out" "prof.json" "results.json" "results.xml" "dbg_*" "*.xref" "results.prof" "profiler.json" "profile.options")

for F in "${ARR[@]}"; do
	echo "deleting $F"
	find test_projects -name "$F" $DELETE
done

rm -rf artifacts/ coverage/
