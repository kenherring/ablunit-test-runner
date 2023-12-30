using OpenEdge.Core.Assert.

@Test.
procedure testProcedure1 :
  Assert:Equals(1,1).
end procedure.

@Test.
procedure testProcedure2 :
	if false then
  		Assert:Equals(1,1).
	else
		Assert:Equals(2,2).
end procedure.
