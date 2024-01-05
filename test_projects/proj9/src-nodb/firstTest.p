block-level on error undo, throw.
using OpenEdge.Core.Assert.

@Test.
procedure testProcedureName :
  Assert:Equals(2,2).
end procedure.
