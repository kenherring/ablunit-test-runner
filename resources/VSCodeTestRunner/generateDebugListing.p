// TODO set DB aliases
message "Generating debug listing for source file:" os-getenv('SOURCE_FILE').
compile value(os-getenv('SOURCE_FILE')) save = false debug-list value(os-getenv('DEBUG_LISTING_PATH')).
