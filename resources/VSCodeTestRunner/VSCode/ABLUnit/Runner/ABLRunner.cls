using OpenEdge.ABLUnit.Model.TestEntity from propath.
using OpenEdge.ABLUnit.Model.TestRootModel from propath.
using OpenEdge.ABLUnit.Results.TestTypeResult from propath.
using OpenEdge.ABLUnit.Runner.TestConfig from propath.
using OpenEdge.ABLUnit.Reflection.TypeInfo from propath.
using OpenEdge.Core.Collections.Array from propath.
using Progress.Json.ObjectModel.JsonArray from propath.
using Progress.Json.ObjectModel.JsonDataType from propath.
using Progress.Json.ObjectModel.JsonObject from propath.

block-level on error undo, throw.

class VSCode.ABLUnit.Runner.ABLRunner inherits OpenEdge.ABLUnit.Runner.ABLRunner :

    define temp-table ttEntityMap no-undo
        field entityId as integer
        field entityName as character
        field entityParent as character
        index idx-1 is primary unique entityId.

    define variable VERBOSE as logical no-undo.
    define variable updateFilepath as character no-undo.
    define variable profilerSubstitute as character no-undo.

    constructor public ABLRunner () :
        super().
        constructorCommon().
        if VERBOSE then message "END constructor".
    end constructor.

    constructor public ABLRunner (inputConfig as TestConfig, updateFile as character) :
        super(inputConfig, updateFile).
        constructorCommon().
        this-object:updateFilepath = updateFile.
        if VERBOSE then message "END constructor".
    end constructor.

    method private void constructorCommon () :
        VERBOSE = (os-getenv('VERBOSE') = 'true' or os-getenv('VERBOSE') = '1').
        if VERBOSE then message "constructorCommon".
        createEntityMapRecord(0, 'TEST_ROOT', '').
    end method.

    method public character errorStatusToJsonString (entityId as integer, entityName as character) :
        if VERBOSE then message "errorStatusToJsonString" entityId entityName.
        if not error-status:error then
            undo, throw new Progress.Lang.AppError('No error status to serialize').

        define variable errorJson as JsonObject no-undo.
        define variable msgArr as JsonArray no-undo.
        define variable msgObj as JsonObject no-undo.
        define variable i as integer no-undo.
        define variable serialized as character no-undo.

        errorJson = NEW JsonObject().
        errorJson:Add('error', error-status:error).
        errorJson:Add('errorObjectDetail', error-status:error-object-detail).
        errorJson:Add('instantiatingProcedure', error-status:instantiating-procedure).
        errorJson:Add('numMessages', error-status:num-messages).
        errorJson:Add('type', error-status:type).

        msgArr = NEW JsonArray().
        do i=0 to error-status:num-messages:
            msgObj = NEW JsonObject().
            msgObj:Add('message', error-status:get-message(i)).
            msgObj:Add('number', error-status:get-number(i)).
            msgArr:Add(msgObj).
        end.
        errorJson:Add('messages' + string(i), msgArr).

        errorJson:write(output serialized).
        this-object:updateFile(this-object:updateFilepath, 'SERIALIZED_ERROR ' + serialized, false).
    end method.

    method public character compilerErrorToJsonString () :
        if VERBOSE then message "compilerErrorToJsonString".
        if not compiler:error then
            undo, throw new Progress.Lang.AppError('No compiler error to serialize').

        define variable i as integer no-undo.

        define variable compileErrorJson as JsonObject no-undo.
        define variable j as integer no-undo.
        define variable options as JsonObject no-undo.
        define variable optRaw as character no-undo.
        define variable optKey as character no-undo.
        define variable optValue as character no-undo. // warning or error.  default=warning
        define variable messages as JsonArray no-undo.
        define variable detail as JsonObject no-undo.
        define variable serialized as character no-undo.

        compileErrorJson = NEW JsonObject().
        compileErrorJson:Add('name', 'CompileError').
        compileErrorJson:Add('classType', compiler:class-type).
        compileErrorJson:Add('error', compiler:error).
        compileErrorJson:Add('errorColumn', compiler:error-column).
        compileErrorJson:Add('errorRow', compiler:error-row).
        compileErrorJson:Add('fileName', compiler:file-name).
        compileErrorJson:Add('fileOffset', compiler:file-offset).
        compileErrorJson:Add('instantiatingProcedure', compiler:instantiating-procedure).
        compileErrorJson:Add('multiCompile', compiler:multi-compile).
        compileErrorJson:Add('numMessages', compiler:num-messages).

        compileErrorJson:Add('optionsRaw', compiler:options).
        if num-entries(compiler:options) > 0 then
        do: // https://docs.progress.com/bundle/abl-reference/page/OPTIONS-attribute.html#OPTIONS-attribute
            options = NEW JsonObject().
            do j = 1 to num-entries(compiler:options):
                if entry(0, compiler:options) = '' then
                    next.
                optRaw = entry(j, compiler:options).
                optKey = entry(1, optRaw, ':').
                optValue = 'Warning'.
                if num-entries(optRaw, ',') > 1 then
                    optValue = entry(2, optRaw, ',').
                options:Add(optKey, optValue).
            end.
            compileErrorJson:add('options', options).
        end.

        compileErrorJson:Add('stopped', compiler:stopped).
        compileErrorJson:Add('type', compiler:type).
        compileErrorJson:Add('warning', compiler:warning).

        messages = NEW JsonArray().

        if compiler:num-messages > 0 then
        do:
            do i = 1 to compiler:num-messages:
                detail = NEW JsonObject().
                detail:Add('column', compiler:get-column(i)).
                detail:Add('errorColumn', compiler:get-error-column(i)).
                detail:Add('errorRow', compiler:get-error-row(i)).
                detail:Add('fileName', compiler:get-file-name(i)).
                detail:Add('fileOffset', compiler:get-file-offset(i)).
                detail:Add('message', compiler:get-message(i)).
                case compiler:get-message-type(i):
                    when 1 then
                        detail:Add('messageType', '1-Error').
                    when 2 then
                        detail:Add('messageType', '2-Warning').
                    when 3 then
                        detail:Add('messageType', '3-Preprocessor Directive').
                    otherwise
                        undo, throw new Progress.Lang.AppError('unexpected message type: ' + string(compiler:get-message-type(i))).
                end case.
                detail:Add('number', compiler:get-number(i)).
                detail:Add('row', compiler:get-row(i)).
                messages:Add(detail).
            end.
        end.
        if error-status:error and error-status:num-messages > 0 then
        do:
            do i = i to error-status:num-messages:
                detail = NEW JsonObject().
                if error-status:get-message(i) = '' and error-status:get-number(i) = 0 then
                    next.
                detail:Add('message', error-status:get-message(i)).
                detail:Add('number', error-status:get-number(i)).
                messages:Add(detail).
            end.
        end.

        compileErrorJson:Add('messages', messages).

        compileErrorJson:write(output serialized).
        return serialized.

        catch e as Progress.Lang.Error:
            message 'Error serializing COMPILER:ERROR to json'.
            undo, throw e.
        end catch.
    end method.

    method public override TypeInfo BuildTypeInfo (testCase as character &IF PROVERSION >= "12.5" &THEN , testType as character &ENDIF) :
        if VERBOSE then message "BuildTypeInfo".
        define variable typeInfo as TypeInfo no-undo.
        typeInfo = super:BuildTypeInfo(testCase &IF PROVERSION >= "12.5" &THEN , testType &ENDIF).
        return typeInfo.

        catch e as Progress.Lang.AppError:
            define variable i as integer no-undo.
            if e:getMessage(1) begins "Unable to build type info" THEN
            do:
                define variable progname as character no-undo.
                define variable serialized as character no-undo.
                progname = trim(entry(7, e:getMessage(1), ' '),':').
                compile value(progname) save = no no-error.
                if compiler:error then
                do:
                    serialized = compilerErrorToJsonString().
                    message 'ABLUNIT_STATUS=SERIALIZED_ERROR' serialized.
                    // this-object:updateFile(this-object:updateFilepath, 'SERIALIZED_ERROR ' + serialized, false).
                end.
            end.
            undo, throw e.
        end catch.
    end method.

    method public void createEntityMapRecord(entityId as integer, entityName as character, parentName as character) :
        if VERBOSE then message "createEntityMapRecord".
        if can-find(ttEntityMap where ttEntityMap.entityId = entityId) then
            return.
        create ttEntityMap.
        ttEntityMap.entityId = entityId.
        ttEntityMap.entityName = entityName.
        ttEntityMap.entityParent = parentName.
        release ttEntityMap.
    end method.

    method public void mapEntityChildren(parentName as character, testEntities as Array) :
        if VERBOSE then message "mapEntityChildren".
        define variable childTestEntity as TestEntity no-undo.
        define variable i as integer no-undo.
        do i = 1 to testEntities:Size:
            childTestEntity = cast(testEntities:GetValue(i), TestEntity).
            if not valid-object(childTestEntity) then
            do:
                if VERBOSE then message 'childTestEtity is not valid!  testEntities[' + string(i) + '/' + string(testEntities:Size) + ']=' testEntities:GetValue(i).
                next.
            end.
            createEntityMapRecord(childTestEntity:id, childTestEntity:name, parentName).
            mapEntityChildren(childTestEntity:name, childTestEntity:getTestEntities()).
        end.
    end method.

    method public override TestEntity populateTestModel(input testCase as character, input testCount as integer) :
        if VERBOSE then message "populateTestModel".
        define variable testModel as TestEntity no-undo.
        testModel = super:populateTestModel(testCase, testCount).
        mapEntityChildren(testModel:name, testModel:getTestEntities()).
        return testModel.
    end method.

    method public override void updateFile(updateFile as character, content as longchar, override as logical) :
        if VERBOSE then message "updateFile".
        define variable action as character no-undo.
        define variable entityId as integer init -1 no-undo.
        define variable entityName as character no-undo.
        action = entry(1, content, ' ').
        if VERBOSE then message "ACTION='" + ACTION + "'".
        if action <> "SERIALIZED_ERROR" then
            super:updateFile(updateFile, content, override).

        if action <> "TEST_TREE" and action <> "COMPLETE" and num-entries(content, ' ') > 1 then
        do:
            define variable entry2 as character no-undo.
            entry2 = entry(2, content, ' ').
            entityId = integer(entry2).
            entityName = getEntityName(entityId).
            if action = "TEST_END" then
            do:
                define variable duration as character no-undo.
                if num-entries(content, ' ') > 2 then
                    duration = entry(3, content, ' ').
                else
                    duration = "0".
                message 'ABLUNIT_STATUS=~{"action":"' + action + '","entityId":' + string(entityId) + ',"entityName":"' + entityName + '", "duration": "' + duration + '"~}'.
            end.
            else
                message 'ABLUNIT_STATUS=~{"action":"' + action + '","entityId":' + string(entityId) + ',"entityName":"' + entityName + '"~}'.
        end.
        else
            message 'ABLUNIT_STATUS=~{"action":"' + action + '"~}'.

        if (content begins 'TEST_END ' or
            content begins 'TEST_EXCEPTION ' or
            content begins 'TEST_FAIL ' or
            content begins 'TEST_IGNORED ') then
        do:
            if VERBOSE then message "restarting profiler (entityId=" + string(entityId) + ", entityName=" + entityName + ")".
            restartProfiler(entityName, entityId).
        end.
        return.

        catch e as Progress.Lang.Error:
            message 'Error updating file ' + updateFile.
            undo, throw e.
        end catch.
    end method.

    method public character getEntityName (entityId as integer) :
        if VERBOSE then message "getEntityName".
        define variable entityName as character init '<name>' no-undo.
        define variable parentName as character init '<parent>' no-undo.
        find ttEntityMap where
             ttEntityMap.entityId = entityId
             no-error.
        if available ttEntityMap then
        do:
            entityName = ttEntityMap.entityName.
            parentName = ttEntityMap.entityParent.
        end.
        return parentName + ' ' + entityName.
    end method.

    method public void restartProfiler(testinfo as character, entityId as integer) :
        if VERBOSE then message "restartProfiler".
        if profiler:description matches "*[perTest=false]" then
            return. // not perTest

        define variable extension as character no-undo.
        define variable profile-file-name as character no-undo.
        define variable basename as character no-undo.

        if num-entries(profiler:description, '|') = 1 then
            profiler:description = profiler:description + '|'.
        entry(2, profiler:description, '|') = testinfo.

        if profilerSubstitute = '' then
        do:
            extension = entry(num-entries(profiler:file-name, '.'), profiler:file-name, '.').
            basename = substring(profiler:file-name, 1, length(profiler:file-name) - length(extension) - 1).
            profilerSubstitute = basename + '_&1.' + extension.
        end.
        profile-file-name = profiler:file-name.
        profiler:file-name = substitute(profilerSubstitute, string(entityId)).

        profiler:write-data().
        profiler:file-name = profile-file-name.
    end method.

end class.
