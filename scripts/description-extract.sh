#!/bin/bash

#TODO review what these look like in vscode

jq () {
	jq-windows-amd64.exe "$@"
}

initialize() {
	mkdir -p docs/configDescriptions/
	KEYS=($(jq -r '.contributes.configuration.properties | keys | .[]' package.json | tr -d '\r'))
}

get_descriptions() {

	for KEY in "${KEYS[@]}"; do
		echo "$KEY"

		# DESCRIPTION=$(jq -r '.contributes.configuration.properties."'"$KEY"'"' < package.json)
		DESCRIPTION=$(jq -r '.contributes.configuration.properties."'"$KEY"'".markdownDescription' < package.json)
		echo -e "\n\n-----"
		echo "DESCRIPTION"
		echo "$DESCRIPTION"
		echo -e "\n\n-----\n"
		echo "$DESCRIPTION" > "docs/configDescriptions/$KEY.md"
	done
}

########## MAIN BLOCK ##########
initialize
get_descriptions
echo "Successfully extracted configuration descriptions!"
