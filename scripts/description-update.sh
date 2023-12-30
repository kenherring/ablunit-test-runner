#!/bin/bash
set -eou pipefail

jq () {
	jq-windows-amd64.exe "$@"
}

update_descriptions () {
	for F in docs/configDescriptions/*.md; do
		echo "$F"
		PROPERTY="$(basename "$F" .md)"
		# shellcheck disable=SC2016
		DESCRIPTION=$(sed 's/"/\\"/g' < "$F" |
						sed 's/\\/\\\\/g' |
						sed 's/`/\\`/g' |
						sed 's/\$/\\$/g' |
						sed 's/{/\\{/g' |
						sed 's/}/\\}/g' |
						sed 's/$/\\n/' |
						sed 's/:/\\:/g' |
						tr -d '\n' |
						sed 's/\\n$//')
						# sed 's/`/\\`/g' |

		update_json_field "$PROPERTY" "$DESCRIPTION"
	done
	TAB=$'\t'
	sed -i 's/  /'"${TAB}"'/g' package.json
}

update_json_field () {
	local PROPERTY="$1"
	local DESCRIPTION="$2"

	jq  --arg d "$DESCRIPTION" '.contributes.configuration.properties."'"$PROPERTY"'".markdownDescription = $d' < package.json > package.json.tmp

	rm package.json
	mv package.json.tmp package.json
}

create_markdown_table () {
	KEYS=($(jq -r '.contributes.configuration.properties | keys | .[]' < package.json | tr -d '\r'))
	{
		echo "<!-- START CONFIGURATION PROPERTIES -->"
		echo -e "## Configuration Properties\n"
		echo "| Property | Default | Description |"
		echo "| --- | --- | --- |"
	} > README_table.md

	for KEY in "${KEYS[@]}"; do
		echo -e "Updating markdown field $KEY..."
		PROPERTY=$(echo "$KEY" | tr -d '"')
		DEFAULT=$(jq -r '.contributes.configuration.properties."'"$PROPERTY"'".default' < package.json | tr -d '\n' | tr -d '\r')
		DEFAULT=${DEFAULT//\|/\\\|}
		DEFAULT=${DEFAULT//\"\]/\" \]}
		if [ "$DEFAULT" != "" ]; then
			DEFAULT="\`$DEFAULT\`"
		fi
		DESCRIPTION=$(jq -r '.contributes.configuration.properties."'"$PROPERTY"'".markdownDescription' < package.json)
		DESCRIPTION=${DESCRIPTION//\\n/<br>}
		DESCRIPTION=${DESCRIPTION//\\\\"/"}

		echo "| \`$PROPERTY\` | $DEFAULT | $DESCRIPTION |" >> README_table.md
	done
	echo "<!-- END CONFIGURATION PROPERTIES -->" >> README_table.md
}

insert_markdown_table () {
	rm README.md.tmp || true
	IN_CONFIG=false
	# shellcheck disable=SC2162
	while IFS= read -r line; do
		if [[ $line == "<!-- START CONFIGURATION PROPERTIES -->" ]]; then
			IN_CONFIG=true
			continue
		fi
		if ! $IN_CONFIG; then
			printf '%s\n' "$line" >> README.md.tmp
		elif [[ $line == "<!-- END CONFIGURATION PROPERTIES -->" ]]; then
			cat README_table.md >> README.md.tmp
			IN_CONFIG=false
		fi
	done < README.md

	rm README.md README_table.md
	mv README.md.tmp README.md

}

########## MAIN BLOCK ##########
update_descriptions
create_markdown_table
insert_markdown_table
echo "Successfully updated configuration descriptions!"
