block-level on error undo, throw.

define variable VERBOSE as logical no-undo.

run main.
return.

catch s as Progress.Lang.Stop:
	// if VERBOSE then message "CATCH STOP generateDebugListing.p (s.message=" + s:toString() + ")".
	message "CATCH STOP generateDebugListing.p (s.message=" + s:toString() + ")".
	undo, throw s.
end catch.
catch e as Progress.Lang.Error:
	// message "CATCH ERROR generateDebugListing.p (e.message=" + e:GetMessage(0) + " (" + string(e:GetMessageNum(0)) + "))".
	undo, throw e.
end catch.

function getEnvVar returns character (varname as character) :
	define variable varvalue as character no-undo.
	varvalue = os-getenv(varname).
	if varvalue = ? then
		varvalue = ''.
	return varvalue.
end function.

procedure main :
    run setPropath.
    run VSCode/createDatabaseAliases.p(false).

	define variable sourceFile as character no-undo.
	define variable rcodeDirectory as character no-undo.
	define variable debugListingFile as character no-undo.
	sourceFile = getEnvVar('SOURCE_FILE').
	rcodeDirectory = getEnvVar('RCODE_DIRECTORY').
	debugListingFile = getEnvVar('DEBUG_LISTING_FILE').

	if VERBOSE then message 'SOURCE_FILE=' + sourceFile.
	if VERBOSE then message 'RCODE_DIRECTORY=' + rcodeDirectory.
	if VERBOSE then message 'DEBUG_LISTING_FILE=' + debugListingFile.

	message 'Generating debug listing for source file: ' sourceFile + '~n~trcodeDir=' + rcodeDirectory + '~n~tdebugListingFile=' + debugListingFile.
	compile value(sourceFile) save = (rcodeDirectory <> '') into value(rcodeDirectory) debug-list value(debugListingFile).
end procedure.

procedure setPropath :
	define variable inputPropath as character no-undo.
	define variable vscodeDir as character no-undo.

	if search('VSCode/createDatabaseAliases.p') = ? then
	do:
		inputPropath = os-getenv('PROPATH').
		if inputPropath <> '' and inputPropath <> ? then
			propath = inputPropath + ',' + propath.
		else
		do:
			vscodeDir = replace(entry(2, program-name(1), ' '), '~\', '/').
			entry(num-entries(vscodeDir, '/'), vscodeDir, '/') = ''.
			propath = vscodeDir + ',' + propath.
		end.
	end.
end procedure.
