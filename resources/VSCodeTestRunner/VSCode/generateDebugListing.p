block-level on error undo, throw.

define variable VERBOSE as logical no-undo.
VERBOSE = true.

run main.
return.

catch s as Progress.Lang.Stop:
	message "CATCH STOP generateDebugListing.p".
	undo, throw s.
end catch.
catch e as Progress.Lang.Error:
	message "CATCH ERROR generateDebugListing.p".
	undo, throw e.
end catch.
finally:
	message "FINALLY generateDebugListing.p".
end finally.

procedure main :
    run setPropath.
    run VSCode/createDatabaseAliases.p(false).

	if VERBOSE then message 'SOURCE_FILE=' + os-getenv('SOURCE_FILE').
	if VERBOSE then message 'DEBUG_LISTING_FILE=' + os-getenv('DEBUG_LISTING_FILE').
    message "Generating debug listing for source file:" os-getenv('SOURCE_FILE').
    compile value(os-getenv('SOURCE_FILE')) save=false debug-list value(os-getenv('DEBUG_LISTING_FILE')).
end procedure.

procedure setPropath :
	define variable inputPropath as character no-undo.
	define variable vscodeDir as character no-undo.

	if search('VSCode/createDatabaseAliases.p') = ? then
	do:
		inputPropath = os-getenv('PROPATH').
		if inputPropath <> '' then
			propath = inputPropath + ',' + propath.
		else
		do:
			vscodeDir = replace(entry(2, program-name(1), ' '), '~\', '/').
			entry(num-entries(vscodeDir, '/'), vscodeDir, '/') = ''.
			propath = vscodeDir + ',' + propath.
		end.
	end.
end procedure.
