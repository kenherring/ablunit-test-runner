block-level on error undo, throw.

using OpenEdge.Core.Collections.Array.
using OpenEdge.ABLUnit.Results.TestTestResult.
using Progress.Lang.Object.


class OpenEdge.ABLUnit.Results.TestResultList inherits Array:
    /* Default constructor */
    constructor public TestResultList (  ):
        super ().
        this-object:AutoExpand = true.
    end constructor.

    method override public logical Add(input pIndex as integer, input pElement as Object ):
        // The backing of this collection is an Array, which allows null items, rather than
        // a List, which does not. So we act like a List here
        if not valid-object(pElement) then
            return false.

        message "pElement=" + string(pElement) + ', pIndex=' + string(pIndex).
        return super:Add(pIndex, pElement).
    end method.

    method override public logical Add(input pElement as Object):
        // The backing of this collection is an Array, which allows null items, rather than
        // a List, which does not. So we act like a List here
        if not valid-object(pElement) then
            return false.

        message "pElement=" + string(pElement).

        define variable res as TestTestResult no-undo.
        res = cast(pElement, TestTestResult) no-error.
        if valid-object(res) then
        do:
            message "IS TestTestResult res:TestName=" + res:TestName.
            writeProfilerForTest(res).
        end.
        else
        do:
            message "NOT TestTestResult"
            error-status:error = false.
        end.

        return super:Add(pElement).
    end method.

    method private void writeProfilerForTest (res as TestTestResult) :
        define variable extension as character no-undo.
        define variable profile-file-name as character no-undo.
        define variable basename as character no-undo.

        message "profiler:file-name=" + profiler:file-name.

        extension = entry(num-entries(profiler:file-name, '.'), profiler:file-name, '.').
        message "extension=" + extension.
        basename = substring(profiler:file-name, 1, length(profiler:file-name) - length(extension) - 1).
        message "basename=" + basename.

        profile-file-name = profiler:file-name.
        profiler:file-name = basename + '_' + res:TestName + '.' + extension.
        message "new profile-file-name=" + profiler:file-name.
        // profiler:profiling = no.
        profiler:write-data().

        profiler:file-name = profile-file-name.
        // profiler:profiling = yes.


    end method.

end class.
