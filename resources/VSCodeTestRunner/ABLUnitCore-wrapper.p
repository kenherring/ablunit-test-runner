using OpenEdge.ABLUnit.Runner.ABLRunner.
using OpenEdge.ABLUnit.Runner.TestConfig.
block-level on error undo, throw.
create widget-pool.

define variable quitOnEnd as logical no-undo init false.

run main.
if quitOnEnd then
	quit.
else
	return.

////////// FUNCS AND PROCS //////////
run main.
return.

procedure createDatabaseAliases :
    define variable aliasesSessionParam as character no-undo.
    define variable paramStart as integer no-undo.
    define variable paramEnd as integer no-undo.
    define variable dbCount as integer no-undo.
    define variable aliasCount as integer no-undo.
    define variable aliasList as character no-undo.
    define variable aliasName as character no-undo.
    define variable databaseName as character no-undo.

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
end procedure.

function getParameter returns character (input params as character, input name as character) :
	define variable cnt as integer no-undo.
	do cnt = 1 to num-entries(params,' '):
		if entry(cnt,params,' ') begins name + '=' then
			return entry(2, entry(cnt, params, ' '), '=').
	end.
	return ''.
end function.

function readTestConfig returns TestConfig (filepath as character) :
	return new TestConfig(cast((new Progress.Json.ObjectModel.ObjectModelParser()):ParseFile(filepath), Progress.Json.ObjectModel.JsonObject)).
end function.

procedure main :
	define variable ablRunner as class ABLRunner no-undo.
	define variable testConfig as class TestConfig no-undo.
	define variable updateFile as character no-undo.

    run createDatabaseAliases.

	assign updateFile = getParameter(trim(trim(session:parameter,'"'),"'"), 'ATTR_ABLUNIT_EVENT_FILE').
	// message "updateFile =" updateFile.
	testConfig = readTestConfig(getParameter(trim(trim(session:parameter,'"'),"'"), 'CFG')).

	ablRunner = new ABLRunner(testConfig, updateFile).
	ablRunner:RunTests().

	catch e as Progress.Lang.Error:
		quitOnEnd = (testConfig = ?) or testConfig:quitOnEnd.
		if testConfig = ? then
			return error new Progress.Lang.AppError ("An error occured: " + e:GetMessage(1), 0).

		if testConfig:WriteLog then
		do:
			// Don't change the log mid session if we're already logging...
			if log-manager:logfile-name = ? then
			do:
				if testConfig:outputLocation <> ? then
					log-manager:logfile-name = testConfig:outputLocation + 'ablunit.log'.
				else
					log-manager:logfile-name = session:temp-dir + "ablunit.log".
			end.
			log-manager:write-message (e:GetMessage(1)).
			if type-of(e, Progress.Lang.AppError) then
				log-manager:write-message (cast(e, Progress.Lang.AppError):ReturnValue).
			log-manager:write-message (e:CallStack).
		end.
		if testConfig:ShowErrorMessage then
			message e:GetMessage(1)
			view-as alert-box error.
		if testConfig:ThrowError then
			undo, throw e.
	end.
	finally:
		if quitOnEnd then
			quit.
		else
			return. /* Need to return to avoid errors when running as an ANT task. */
	end.

end procedure.
