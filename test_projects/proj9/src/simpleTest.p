using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure test_proc :
    Assert:Equals(1,1).
end procedure.
