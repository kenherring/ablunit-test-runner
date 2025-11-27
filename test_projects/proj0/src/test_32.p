block-level on error undo, throw.
using OpenEdge.Core.Assert.

@Test.
procedure procedureName :
    define variable opValue as integer no-undo.
    run super_proc1(1, output opValue).
    Assert:equals(opValue, 2).
end procedure.
