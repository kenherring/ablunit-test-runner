using OpenEdge.ABLUnit.Model.TestEntity.
using OpenEdge.ABLUnit.Model.TestRootModel.
using OpenEdge.ABLUnit.Results.TestTypeResult.
using OpenEdge.ABLUnit.Runner.TestConfig.
using OpenEdge.Core.Collections.Array.

class VSCode.ABLUnit.Runner.ABLRunner inherits OpenEdge.ABLUnit.Runner.ABLRunner :


    define temp-table ttEntityMap no-undo
        field entityId as integer
        field entityName as character
        field entityParent as character
        index idx-1 is primary unique entityId.
    
    define variable VERBOSE as logical no-undo.

    constructor public ABLRunner ():
        super().
        VERBOSE = (os-getenv('VERBOSE') = 'true' or os-getenv('VERBOSE') = '1').
    end constructor.

    constructor public ABLRunner (inputConfig as TestConfig, updateFile as character):
        super(inputConfig, updateFile).
        VERBOSE = (os-getenv('VERBOSE') = 'true' or os-getenv('VERBOSE') = '1').
    end constructor.

    method public void createEntityMapRecord(entityId as integer, entityName as character, parentName as character):
        if VERBOSE then message "createEntityMapRecord".
        if can-find(ttEntityMap where ttEntityMap.entityId = entityId) then
            return.
        create ttEntityMap.
        ttEntityMap.entityId = entityId.
        ttEntityMap.entityName = entityName.
        ttEntityMap.entityParent = parentName.
        release ttEntityMap.
    end method.

    method public void mapEntityChildren(parentName as character, testEntities as Array):
        if VERBOSE then message "mapEntityChildren".
        define variable childTestEntity as TestEntity no-undo.
        define variable i as integer no-undo.
        do i = 1 to testEntities:Size:
            childTestEntity = cast(testEntities:GetValue(i), TestEntity).
            createEntityMapRecord(childTestEntity:id, childTestEntity:name, parentName).
            mapEntityChildren(childTestEntity:name, childTestEntity:getTestEntities()).
        end.
    end method.

    METHOD PUBLIC override TestEntity populateTestModel(INPUT testCase AS CHARACTER, INPUT testCount AS INTEGER):
        if VERBOSE then message "populateTestModel".
        define variable testModel as TestEntity no-undo.
        testModel = super:populateTestModel(testCase, testCount).
        mapEntityChildren(testModel:name, testModel:getTestEntities()).
        return testModel.
    END METHOD.

    method public override void updateFile(updateFile as character, content as longchar, override as logical) :
        if VERBOSE then message "updateFile".
        define variable entityId as integer no-undo.
        super:updateFile(updateFile, content, override).

        if content begins 'TEST_END ' or
           content begins 'TEST_EXCEPTION ' then
        do:
            entityId = integer(entry(2, content, ' ')).
            if (entityId > 0) then
                restartProfiler(getEntityName(entityId), entityId).
            if error-status:error then
                message "ERROR: " + error-status:get-message(1) + ' (' + string(error-status:get-number(1)) + ')'.
        end.

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
        if entityId = 0 then
            return. // TEST_ROOT

        define variable extension as character no-undo.
        define variable profile-file-name as character no-undo.
        define variable basename as character no-undo.

        if num-entries(profiler:description, '|') = 1 then
            profiler:description = profiler:description + '|'.
        entry(2, profiler:description, '|') = testinfo.

        extension = entry(num-entries(profiler:file-name, '.'), profiler:file-name, '.').
        basename = substring(profiler:file-name, 1, length(profiler:file-name) - length(extension) - 1).
        profile-file-name = profiler:file-name.
        profiler:file-name = basename + '_' + string(entityId) + '.' + extension.

        profiler:write-data().
        profiler:file-name = profile-file-name.
    end method.

end class.
