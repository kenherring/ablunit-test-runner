using OpenEdge.Core.Assert.
block-level on error undo, throw.

function someFunc returns integer (ipChar as character) :
    return integer(ipChar).
end function.

@Test.
procedure test_call_error :
    define variable val as integer noundo. // COMPILE ERROR noundo <> no-undo
end procedure.
