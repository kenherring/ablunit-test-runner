block-level on error undo, throw.

@Test.
procedure testProcedure :
  OpenEdge.Core.Assert:isTrue(yes).
  OpenEdge.Core.Assert:isTrue(yes).
end procedure.

@Test.
procedure thisTestFails :
  OpenEdge.Core.Assert:isTrue(false).
end procedure.

@Test.
procedure thisTestPasses:
  OpenEdge.Core.Assert:isTrue(true).
  OpenEdge.Core.Assert:isTrue(yes).
  OpenEdge.Core.Assert:isTrue(yes).
end procedure.
