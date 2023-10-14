block-level on error undo, throw.

message 100.

@Test.
procedure testProcedure :
  run procThrowsException.p.
  OpenEdge.Core.Assert:isTrue(yes).
end procedure.
