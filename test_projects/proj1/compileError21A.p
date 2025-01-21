using OpenEdge.Core.Assert.
block-level on error undo, throw.

function someFunc returns integer (ipChar as character) :
    return integer(ipChar).
end function.

@Test.
procedure test_call_error :
    if false then
        message "someMessage".
    run compileError21B.p.
    Assert:Equals(1,1).
end procedure.
