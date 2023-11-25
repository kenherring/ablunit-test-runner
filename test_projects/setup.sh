#!/bin/bash
set -eou pipefail

export PATH=$PATH:$DLC/ant/bin

cd test_projects/proj0
if command -v ant; then
	ant
else
	"$DLC"/ant/bin/ant
fi
