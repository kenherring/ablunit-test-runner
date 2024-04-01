block-level on error undo, throw.
using OpenEdge.Core.Assert.

@Test.
procedure AtSetup :
    Assert:equals(1,1).
end procedure.
