#!/bin/bash
set -eou pipefail

usage () {
	echo "
usage: $0 [-p] [-h]
options:
  -p        push docker images to dockerhub after build
  -n        no cache
  -h        show this help message and exit
" >&2
}

initialize () {
	local OPT OPTARG OPTIND
	while getopts "pnh" OPT; do
		case "$OPT" in
			p)	DOCKER_PUSH=true ;;
			n)  NO_CACHE=true ;;
			h) 	usage && exit 0 ;;
			*)	echo "Invalid option: -$OPT" >&2 && usage && exit 1 ;;
		esac
	done
	echo "iniailizing..."

	if [ -z "$DLC" ]; then
		echo "ERROR: DLC environment variable not set... exiting"
		exit 1
	fi
	if [ ! -f "$DLC/progress.cfg" ]; then
		echo "ERROR: \$DLC/progress.cfg file not found... exiting"
		echo " - full path: $DLC/progress.cfg"
		exit 1
	fi

	if [ -z "${DOCKER_TAGS:-}" ]; then
		DOCKER_TAGS=()
		DOCKER_TAGS+=('12.2.12')
		# DOCKER_TAGS+=('12.7.0')
		DOCKER_TAGS+=('12.8.1')
		# DOCKER_TAGS+=('12.8.3')
		# DOCKER_TAGS+=('12.8.4')
		DOCKER_TAGS+=('12.8.5')
	fi

	mkdir -p docker/.rssw
	cp ~/.rssw/oedoc.bin docker/.rssw/oedoc.bin
}

build_images () {
	echo "building images... (pwd=$(pwd))"

	local ARGS=()
	if ${NO_CACHE:-false}; then
		ARGS+=('--no-cache')
	fi

	for DOCKER_TAG in "${DOCKER_TAGS[@]}"; do
		echo "Building docker image for OE $DOCKER_TAG"
		docker build docker "${ARGS[@]}" \
			--build-arg OE_VERSION="$DOCKER_TAG" \
			--secret id=license,src="$DLC/progress.cfg" \
			-t "ablunit-test-runner:$DOCKER_TAG"

		echo "validate and tag new image..."
		## ensure we're leaving behind a license or ssh-keys
		## since we're using secret mounts we shouldn't be, but good to be safe in case it changes later
		## alternative option - use a secret mount: https://docs.docker.com/build/building/secrets/#secret-mounts
		if ! docker run --rm "ablunit-test-runner:$DOCKER_TAG" bash -c 'test ! -f ~/.ssh/*'; then
			echo "ERROR: found ssh key(s) left in the docker image..."
			exit 1
		fi
		## tag with the org now that we know it doesn't have an accidental license exposure
		docker tag "ablunit-test-runner:$DOCKER_TAG" "kherring/ablunit-test-runner:$DOCKER_TAG"
	done
	SUCCESS_MESSAGE="Docker image(s) built successfully!"
}

push_images () {
	${DOCKER_PUSH:-false} || return 0
	echo "pushing images to dockerhub..."
	for DOCKER_TAG in "${DOCKER_TAGS[@]}"; do
		docker push "kherring/ablunit-test-runner:$DOCKER_TAG"
	done
	SUCCESS_MESSAGE="Docker image(s) pushed successfully!"
}

########## MAIN BLOCK ##########
initialize "$@"
build_images
push_images
echo "$SUCCESS_MESSAGE"
