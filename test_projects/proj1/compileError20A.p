using OpenEdge.Core.Assert.
block-level on error undo, throw.

function someFunc returns integer (ipChar as character) :
    return integer(ipChar).
end function.

@Test.
procedure testProcedureName :
  Assert:Equals(1,1).
end procedure.

@Test.
procedure test_call_error :
    message 'this-procedure:name=' + this-procedure:name.
    run compileError20B.p.
    Assert:Equals(1,1).
end procedure.
