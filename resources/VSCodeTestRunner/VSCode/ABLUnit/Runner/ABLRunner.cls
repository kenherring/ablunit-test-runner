
block-level on error undo, throw.

using OpenEdge.ABLUnit.Model.TestEntity.
using OpenEdge.ABLUnit.Runner.TestConfig.
using OpenEdge.ABLUnit.Writer.IResultsWriter.
using OpenEdge.ABLUnit.Writer.ResultsXmlWriter.
using Progress.Json.ObjectModel.JsonArray.
using Progress.Json.ObjectModel.JsonObject.

class VSCode.ABLUnit.Runner.ABLRunner inherits OpenEdge.ABLUnit.Runner.ABLRunner :

    define protected variable testConfig as TestConfig no-undo.
    define protected variable updateFile as character no-undo.
    define protected variable ablResultsFile as character no-undo.
    define protected variable prevStackTraceProperty as logical no-undo.
    define protected variable oldWarningsList as character no-undo.

    constructor ABLRunner (testConfigIn as TestConfig, updateFileIn as character) :
        super(testConfigIn, updateFileIn).
        updateFile = updateFileIn.
        testConfig = testConfigIn.
    end constructor.

    method override public void RunTests ( ):
        define variable testsArray as JsonArray no-undo.
        define variable testCasesArray as JsonArray no-undo.
        define variable testIndex as integer no-undo.
        define variable testEntity as TestEntity no-undo.
        define variable writer as IResultsWriter no-undo.

        // ---------- !!! ----------
        // testsArray = testConfig:testsJson.

        define variable testJson as JsonObject no-undo.
        define variable testResource as character no-undo.

        // Check if there's a ServiceManager and if that has a results writer defined
        if valid-object(Ccs.Common.Application:ServiceManager) then
        do:
            assign writer = cast(Ccs.Common.Application:ServiceManager:getService(get-class(IResultsWriter)), IResultsWriter)
                   no-error.
            // in case an error was raised by the getService() call, clear it out (ie totally ignore it)
            assign error-status:error = no.
        end.

        if not valid-object(writer) then
            assign writer = new ResultsXmlWriter().

        this-object:FindXrefFiles().

        do testIndex = 1 to testsArray:Length:
            testJson = testsArray:GetJsonObject(testIndex).
            if (testJson:Has("folder")) then do:
                testResource = testJson:GetCharacter("folder").
                testEntity = populateTestModel(testResource, 1).
            end.
            else if (testJson:Has("test")) then do:
                testResource = testJson:GetCharacter("test").
                if (testJson:Has("cases")) then do:
                    testCasesArray = testJson:GetJsonArray("cases").
                    define variable testCase as character no-undo.
                    testCase = testCasesArray:GetCharacter(1).
                    testEntity = populateTestModel(testResource + "#" + testCase, testCasesArray:Length + 1).
                end.
                else do:
                    testEntity = populateTestModel(testResource, 1).
                end.
            end.
        end.
        // Only print the TEST_TREE once
        updateFile(updateFile, "TEST_TREE" + " " + loadSerializedTree(testEntity), false).

        Logger:Debug(substitute('&1 tests loaded',testsArray:Length)).

        if testEntity ne ? then do:
            runtests(testEntity, updateFile).
            Logger:Debug(substitute('&1 tests run',testsArray:Length)).

            writer:WriteToFile(ablResultsFile, testEntity).
            Logger:Debug(substitute('Results output created at &1', ablResultsFile)).
        end.

        finally:
            /* COMPLETE event has to be updated anyway to complete the session. */
            updateFile(updateFile, "COMPLETE", false).
            session:error-stack-trace = prevStackTraceProperty.
            session:suppress-warnings-list = oldWarningsList.
        end.
    end method.

end class.
