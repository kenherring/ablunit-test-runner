using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure numdbs_test :
    Assert:Equals(1, num-dbs).
end procedure.
