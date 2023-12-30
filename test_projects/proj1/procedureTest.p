using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure test_proc :
    log-manager:write-message("1").
    Assert:Equals(1,1).
end procedure.

@Test.
procedure test_proc_fail :
    Assert:Equals(2,1).
end procedure.

function someFunc returns integer (ipChar as character) :
    return integer(ipChar).
end function.

@Test.
procedure test_pass :
    Assert:Equals(1,1).
end procedure.

@Test.
procedure test_call_fail_1 :
    define variable val as integer no-undo.
    val = someFunc("1").
    Assert:Equals(val,2).
    Assert:Equals(true,false).
end procedure.

@Test.
procedure test_call_error :
    define variable val as integer no-undo.
    val = someFunc("true").
    Assert:Equals(val,2).
end procedure.
