using OpenEdge.Core.Assert.
block-level on error undo, throw.

function someFunc returns integer (ipChar as character) :
    return integer(ipChar).
end function.

procedure test_call_error :
    define variable 22B as integer no-usndo.
    val = someFunc("true").
    Assert:Equals(val,2).
end procedure.
