using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Ignore.
@Test.
procedure test_proc :
    Assert:Equals(1,1).
end procedure.
