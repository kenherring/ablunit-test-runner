using OpenEdge.ABLUnit.Runner.ABLRunner.
using OpenEdge.ABLUnit.Runner.TestConfig.
using OpenEdge.Core.StringConstant.
using Progress.Json.ObjectModel.JsonObject.
using Progress.Json.ObjectModel.ObjectModelParser.
using Progress.Lang.AppError.
using Progress.Lang.Error.

block-level on error undo, throw.

function GetParam returns character (input pParams as character, input prefix as character):
	define variable fileName as character no-undo.
	define variable loop as integer no-undo.
	define variable cnt as integer no-undo.

	assign cnt      = num-entries(pParams, StringConstant:SPACE)
			fileName = '':u
			.
	do loop = 1 to cnt
	while fileName eq '':u:
		if entry(loop, pParams, StringConstant:SPACE) begins prefix + '=':u then
			assign fileName = entry(2, entry(loop, pParams, StringConstant:SPACE), '=':u).
	end.

	return fileName.
end function.

function GetConfigFile returns character (input pParams as character):
	return GetParam(pParams, "CFG").
end function.

function getUpdateFile returns character (input pParams as character):
	return GetParam(pParams, "ATTR_ABLUNIT_EVENT_FILE").
end function.


// ---------- MAIN BLOCK ---------- //

define variable commandParams as character no-undo.
define variable jsonParser as ObjectModelParser no-undo.
define variable configJson as class JsonObject no-undo.
define variable testConfig as class TestConfig no-undo.
define variable ablRunner as class ABLRunner no-undo.
define variable quitOnEnd as logical no-undo init false.
define variable configFile as character no-undo.

session:suppress-warnings = yes.
commandParams = trim(session:parameter, StringConstant:DOUBLE_QUOTE).
configFile = GetConfigFile(commandParams).
jsonParser = new ObjectModelParser().
configJson = cast(jsonParser:ParseFile(configFile), JsonObject).
testConfig = new TestConfig(configJson).
/* If there is no error, we should assign the corresponding 'quitOnEnd' */
quitOnEnd = testConfig:quitOnEnd.
ablRunner = new ABLRunner(testConfig, GetUpdateFile(commandParams)).
ablRunner:RunTests().

catch e as Error:
	if configJson = ? then
	do:
		quitOnEnd = true.
		return error new AppError ("An error occured: " + e:GetMessage(1), 0).
	end.

	if testConfig:WriteLog then
	do:
		log-manager:logfile-name = session:temp-dir + "ablunit.log".
		log-manager:write-message (e:GetMessage(1)).
		if type-of(e, AppError) then
			log-manager:write-message (cast(e, AppError):ReturnValue).
		log-manager:write-message (e:CallStack).
		log-manager:close-log().
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
