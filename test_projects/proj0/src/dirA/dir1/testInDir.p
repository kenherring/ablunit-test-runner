using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure test_proc :
    Assert:Equals(1,1).
end procedure.

@Test.
procedure customerTest :
    for each customer no-lock:
        message customer.name.
    end.
end procedure.

{dirA/inc/somefile.i}
