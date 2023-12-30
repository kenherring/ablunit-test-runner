block-level on error undo, throw.
using OpenEdge.Core.Assert.

@Test.
procedure testProcedureName1 :
  Assert:Equals(1,1).
end procedure.

@Test.
procedure testProcedureName2 :
  Assert:Equals(2,2).
end procedure.

@Test.
procedure testProcedureName3 :
  Assert:Equals(3,3).
end procedure.

@Test.
procedure testProcedureName4 :
  Assert:Equals(4,4).
end procedure.
