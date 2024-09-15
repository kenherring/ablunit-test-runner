/************************************************
Copyright (c) 2013-2020 by Progress Software Corporation. All rights reserved.
*************************************************/
/*------------------------------------------------------------------------
	File        : ABLUnitCore

	Purpose     : Driver program which accepts the testcases, test suites
					and test directory or a configuration file as input in the following format

					Format:
						prowin32 -p ABLUnitCore.p -param TestClass.cls
						prowin32 -p ABLUnitCore.p -param TestClass.cls#TestM1 (for running a particular method inside a testclass)
						prowin32 -p ABLUnitCore.p -param TestProcedure.p
						prowin32 -p ABLUnitCore.p -param TestProcedure.p#TestP1 (for running a particular internal procedure inside a testprocedure)
						prowin32 -p ABLUnitCore.p -param <Full Path of TestFolder>

						or to specify an output directory to write the results

						prowin32 -p ABLUnitCore.p -param "TestClass.cls -outputLocation C:\results"

						or

						prowin32 -p ABLUnitCore.p -param "CFG=C:\<config-file>"
	Syntax      :

	Description : Driver program which accepts the testcases, test suites
					and test directory or a configuration file as input

	Author(s)   : hgarapat

	Created     : Wed Jun 27 12:08:26 IST 2012
	Notes       :
	----------------------------------------------------------------------*/
	USING VSCodeTestRunner.ABLRunner.
	USING OpenEdge.ABLUnit.Runner.TestConfig.
	using OpenEdge.Core.StringConstant.
	USING Progress.Json.ObjectModel.JsonArray.
	USING Progress.Json.ObjectModel.JsonObject.
	USING Progress.Json.ObjectModel.ObjectModelParser.
	USING Progress.Lang.AppError.
	USING Progress.Lang.Error.

	BLOCK-LEVEL ON ERROR UNDO, THROW.

	/* ***************************  Definitions  ************************** */
	DEFINE VARIABLE commandParams AS CHARACTER NO-UNDO.
	DEFINE VARIABLE jsonParser AS ObjectModelParser NO-UNDO.
	DEFINE VARIABLE configJson AS CLASS JsonObject NO-UNDO.
	DEFINE VARIABLE testConfig AS CLASS TestConfig NO-UNDO.
	DEFINE VARIABLE ablRunner AS CLASS ABLRunner NO-UNDO.
	DEFINE VARIABLE quitOnEnd AS LOGICAL NO-UNDO INIT FALSE.
	define variable configFile as character no-undo.

	/* ***************************  UDF  *************************** */
	/* Returns the config file name from the session params */
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

	/* ***************************  Main Block  *************************** */
	// Supress the warnings
	assign SESSION:SUPPRESS-WARNINGS = YES
		 commandParams = TRIM(SESSION:PARAMETER, StringConstant:DOUBLE_QUOTE)
		 .
	assign configFile = GetConfigFile(commandParams).
	assign jsonParser = NEW ObjectModelParser()
		 configJson = CAST(jsonParser:ParseFile(configFile), JsonObject)
		 .

	testConfig = NEW TestConfig(configJson).
	/* If there is no error, we should assign the corresponding 'quitOnEnd' */
	quitOnEnd = testConfig:quitOnEnd.

	ablRunner = NEW ABLRunner(testConfig, GetUpdateFile(commandParams)).
	ablRunner:RunTests().

	CATCH e AS Error:
		IF configJson = ? THEN
		DO:
			quitOnEnd = TRUE.
			RETURN ERROR NEW AppError ("An error occured: " + e:GetMessage(1), 0).
		END.

		IF testConfig:WriteLog THEN
		DO:
			LOG-MANAGER:LOGFILE-NAME = SESSION:TEMP-DIR + "ablunit.log".
			LOG-MANAGER:WRITE-MESSAGE (e:GetMessage(1)).
			if type-of(e, AppError) then
				LOG-MANAGER:WRITE-MESSAGE (cast(e, AppError):ReturnValue).
			LOG-MANAGER:WRITE-MESSAGE (e:CallStack).
			LOG-MANAGER:CLOSE-LOG().
		END.
		IF testConfig:ShowErrorMessage THEN
			MESSAGE e:GetMessage(1)
			VIEW-AS ALERT-BOX ERROR.
		IF testConfig:ThrowError THEN
			UNDO, THROW e.
	END.
	FINALLY:
		IF quitOnEnd THEN
			QUIT.
		ELSE
			{&_proparse_ prolint-nowarn(returnfinally)}
			RETURN. /* Need to return to avoid errors when running as an ANT task. */
	END.
