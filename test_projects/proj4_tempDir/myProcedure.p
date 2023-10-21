block-level on error undo, throw.

@Test.
procedure testProcedure :
  OpenEdge.Core.Assert:isTrue(yes).
end procedure.

@Test.
procedure testProcedure1 :
  OpenEdge.Core.Assert:isTrue(no).
end procedure.
