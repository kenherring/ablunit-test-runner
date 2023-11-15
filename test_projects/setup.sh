#!/bin/bash
set -eou pipefail

export PATH=$PATH:$DLC/ant/bin

echo 100 PWD=$(pwd)
ls -altr
echo 101
ls -altr test_projects
echo 102
git branch --show-current
git log -1
echo 103
cd test_projects/proj0
ant
