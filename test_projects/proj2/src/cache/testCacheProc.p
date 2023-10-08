block-level on error undo, throw.

@Test.
procedure testProcedure :
  OpenEdge.Core.Assert:isTrue(yes).
  pause .5.
end procedure.

@Test.
procedure testProcedure2 :
  OpenEdge.Core.Assert:isTrue(yes).
  pause 1.
end procedure.

@TesT.
PrOceDure     testProceDure4 :
  OpenEdge.Core.Assert:isTrue(yes).
  pause .1.
end procedure.

@Test.
PROCEDURE testProcedure3 :
  OpenEdge.Core.Assert:isTrue(yes).
  pause .2.
end procedure.
