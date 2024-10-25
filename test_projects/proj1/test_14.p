block-level on error undo, throw.

@Test.
procedure test_proc :
    define variable outVal as integer no-undo.
    message "PROPATH=" + PROPATH.
    run return_1.p(output outVal).
    message 'outVal=' + string(outVal).
    OpenEdge.Core.Assert:Equals(1,outVal).
end procedure.
