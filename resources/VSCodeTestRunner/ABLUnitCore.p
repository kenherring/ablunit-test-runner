// This file replaces the standard ABLUnitCore.p when the basedir is
// included as part of the propath ahead of ablunit.pl.

block-level on error undo, throw.
create widget-pool.

define variable testConfig as class OpenEdge.ABLUnit.Runner.TestConfig no-undo.
define variable quitOnEnd as logical init false no-undo.
define variable VERBOSE as logical no-undo.
VERBOSE = (os-getenv('VERBOSE') = 'true' or os-getenv('VERBOSE') = '1').

run setPropath.
run waitForDebuggerVisible.
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

procedure waitForDebuggerVisible :
	define variable cnt as integer no-undo.
	define variable debugReady as logical init false no-undo.

	paramLoop:
	do cnt = 1 to num-entries(session:startup-parameters):
		if entry(cnt, session:startup-parameters) begins '-debugReady' then
		do:
			debugReady = true.
			leave paramLoop.
		end.
	end.
	if not debugReady then
		return.

	etime(yes).
	define variable maxWait as integer init 30000 no-undo.
	maxWait = integer(os-getenv('ABLUNIT_TEST_RUNNER_DEBUG_MAX_WAIT')) no-error.

	do while etime < maxWait and debugger:visible = false:
		// check if debugger is connected every 1 second
		message 'waiting for debugger to connect... (' + string(etime) + '/' + string(maxWait) + 'ms)'.
		pause 1.
	end.

	if debugger:visible then
		message 'Debugger connected!'.
	else
	do:
		if os-getenv('ABLUNIT_TEST_RUNNER_UNIT_TESTING') = 'true' or
			os-getenv('ABLUNIT_TEST_RUNNER_UNIT_TESTING') = '1' then
		do:
			undo, throw new Progress.Lang.AppError("Debugger not connected - exit with code 1 to indicate unit test failure", 99).
		end.
		message 'Debugger not connected - test execution will continue without debugging'.
	end.
end procedure.

procedure printPropath :
	if not VERBOSE then
		return.
	message "PROPATH:".
	define variable cnt as integer no-undo.
	do cnt = 1 to num-entries(propath, ','):
		message ' - '+ entry(cnt, propath).
	end.
end procedure.

procedure main :
	define variable updateFile as character no-undo.
	if VERBOSE then message 'START main'.

	session:suppress-warnings = true.
	run VSCode/createDatabaseAliases.p(VERBOSE).

	assign updateFile = getParameter(trim(trim(session:parameter,'"'),"'"), 'ATTR_ABLUNIT_EVENT_FILE').
	testConfig = readTestConfig(getParameter(trim(trim(session:parameter,'"'),"'"), 'CFG')).
	quitOnEnd = (testConfig = ?) or testConfig:quitOnEnd.
	run VSCode/ABLRunner-wrapper.p(testConfig, updateFile).
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
