#!/bin/sh

echo "'npm test' failed!"
if ! npm run test:cov-after; then
	echo 'exit 2'
	exit 2
fi
echo 'exit 1'
exit 1
