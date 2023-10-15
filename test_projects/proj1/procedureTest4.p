block-level on error undo, throw.

@Test.
procedure testProcedure :
  run progWithInclude.p.
  OpenEdge.Core.Assert:isTrue(yes).
end procedure.