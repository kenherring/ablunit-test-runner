block-level on error undo, throw.
using Progress.Lang.Object from propath.
using OpenEdge.ABLUnit.Results.TestTestResult.

define input parameter pElement as Object no-undo.
define variable res as TestTestResult no-undo.

res = cast(pElement, TestTestResult) no-error.
if valid-object(res) then
do:
    message "IS TestTestResult res:TestName=" + res:TestName.
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
    // profile r:profiling = yes.

end.
else
do:
    message "NOT TestTestResult"
    error-status:error = false.
end.
