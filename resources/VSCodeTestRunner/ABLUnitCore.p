// This file replaces the standard ABLUnitCore.p when the basedir is
// included as part of the propath ahead of ablunit.pl.

using VSCode.ABLUnit.Runner.ABLRunner.

block-level on error undo, throw.
create widget-pool.

message "ABLUnitCore.p start...".
define variable testConfig as class OpenEdge.ABLUnit.Runner.TestConfig no-undo.
define variable quitOnEnd as logical init false no-undo.
define variable VERBOSE as logical no-undo.
VERBOSE = (os-getenv('VERBOSE') = 'true' or os-getenv('VERBOSE') = '1').

if VERBOSE then
	run printPropath.
run main.
return.

// --------- FUNCTIONS ----------

function getParameter returns character (input params as character, input name as character) :
	define variable cnt as integer no-undo.
	do cnt = 1 to num-entries(params,' '):
		if entry(cnt,params,' ') begins name + '=' then
			return entry(2, entry(cnt, params, ' '), '=').
	end.
	return ''.
end function.

function readTestConfig returns OpenEdge.ABLUnit.Runner.TestConfig (filepath as character) :
	return new OpenEdge.ABLUnit.Runner.TestConfig(cast((new Progress.Json.ObjectModel.ObjectModelParser()):ParseFile(filepath), Progress.Json.ObjectModel.JsonObject)).
end function.

function writeErrorToLog returns logical (outputLocation as character, msg as character) :
	// Don't change the log mid session if we're already logging...
	if log-manager:logfile-name = ? then
	do:
		if outputLocation <> ? then
			log-manager:logfile-name = outputLocation + 'ablunit.log'.
		else
			log-manager:logfile-name = session:temp-dir + "ablunit.log".
	end.
	log-manager:write-message(msg).
	return true.
end function.

// ---------- PROCEDURES ----------

procedure printPropath :
	message "PROPATH:".
	define variable cnt as integer no-undo.
	do cnt = 1 to num-entries(propath, ','):
		message ' - '+ entry(cnt, propath).
	end.
end procedure.

procedure createDatabaseAliases :
	define variable aliasesSessionParam as character no-undo.
	define variable paramStart as integer no-undo.
	define variable paramEnd as integer no-undo.
	define variable dbCount as integer no-undo.
	define variable aliasCount as integer no-undo.
	define variable aliasList as character no-undo.
	define variable aliasName as character no-undo.
	define variable databaseName as character no-undo.
	if VERBOSE then message 'START createDatabaseAliases'.

	if index(session:parameter,"ALIASES=") <= 0 then
	do:
		if VERBOSE then message 'END createDatabaseAliases - no ALIASES in session:parameter'.
		return.
	end.

	assign paramStart = index(session:parameter,'ALIASES=') + 8.
	assign paramEnd = index(session:parameter,' ',paramStart).
	if paramEnd = 0 then
		paramEnd = length(session:parameter) + 1.

	assign aliasesSessionParam = substring(session:parameter, paramStart, paramEnd - paramStart).

	do dbCount = 1 to num-entries(aliasesSessionParam,';'):
		assign aliasList = entry(dbCount, aliasesSessionParam,';').
		assign databaseName = entry(1,aliasList).

		do aliasCount = 2 to num-entries(aliaslist,','):
			assign aliasName = entry(aliasCount, aliasList).
			create alias value(aliasName) for database value(databaseName).
		end.
	end.
	if VERBOSE then message 'END createDatabaseAliases'.
end procedure.

procedure main :
	define variable ablRunner as class ABLRunner no-undo.
	define variable updateFile as character no-undo.
	if VERBOSE then message 'START main'.

	session:suppress-warnings = true.
	run createDatabaseAliases.

	assign updateFile = getParameter(trim(trim(session:parameter,'"'),"'"), 'ATTR_ABLUNIT_EVENT_FILE').
	testConfig = readTestConfig(getParameter(trim(trim(session:parameter,'"'),"'"), 'CFG')).
	quitOnEnd = (testConfig = ?) or testConfig:quitOnEnd.

	ablRunner = new ABLRunner(testConfig, updateFile).
	ablRunner:RunTests().
	if VERBOSE then message 'END main'.
end procedure.

// ---------- CATCH and FINALLY ----------

// the `-catchStop 1` startup parameter is default in 11.7+
catch s as Progress.lang.Stop:
	if VERBOSE then message "CATCH STOP ABLUnitCore.p".
	if testConfig = ? or testConfig:showErrorMessage then
		message "STOP condition encountered" view-as alert-box error.
	if testConfig <> ? and testConfig:writeLog then
	do:
		writeErrorToLog(testConfig:outputLocation, 'STOP condition encountered').
		writeErrorToLog(testConfig:outputLocation, s:CallStack).
	end.
	if testConfig = ? or testConfig:throwError then
		undo, throw s.
end catch.

catch e as Progress.Lang.Error:
	if VERBOSE then message "CATCH ERROR ABLUnitCore.p".
	if testConfig = ? then
	do:
		message '[ABLRunner error]' e:getMessage(1) view-as alert-box error.
		return error new Progress.Lang.AppError ("An error occured: " + e:GetMessage(1), 0).
	end.
	if testConfig:WriteLog then
	do:
		writeErrorToLog(testConfig:outputLocation, e:GetMessage(1)).
		if type-of(e, Progress.Lang.AppError) then
			writeErrorToLog(testConfig:outputLocation, cast(e, Progress.Lang.AppError):ReturnValue).
		writeErrorToLog(testConfig:outputLocation, s:CallStack).
	end.
	if testConfig:ShowErrorMessage then
	do:
		define variable i as integer no-undo.
		do i = 1 to e:NumMessages:
			message '[ABLRunner error]' e:GetMessage(i) view-as alert-box error.
		end.
		if not e:GetMessage(1) begins 'Unable to build type info' then
			message '[ABLRunner error]~t' + replace(e:CallStack, '~n', '~n[ABLRunner error]~t').
	end.
	if testConfig:ThrowError then
	do:
		if VERBOSE then message 'THROW ERROR ABLUnitCore.p'.
		undo, throw e.
	end.
end.

finally:
	if VERBOSE then message 'FINALLY ABLUnitCore.p'.
	if quitOnEnd then
	do:
		if VERBOSE then message "quitOnEnd".
		quit.
	end.
	if VERBOSE then message "return".
	return error.
end.
