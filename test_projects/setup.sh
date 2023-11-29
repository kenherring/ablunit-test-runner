#!/bin/bash
set -eou pipefail

export PATH=$PATH:$DLC/ant/bin

# load lots of code for a performance test
if [ ! -f .vscode-test/v12.2.13.0.tar.gz ]; then
	curl -L https://github.com/progress/ADE/archive/refs/tags/v12.2.13.0.tar.gz -o .vscode-test/v12.2.13.0.tar.gz
fi
tar -xf .vscode-test/v12.2.13.0.tar.gz -C test_projects/proj7_load_performance/src

cd test_projects/proj0
if command -v ant; then
	ant
else
	"$DLC"/ant/bin/ant
fi
