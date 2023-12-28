using OpenEdge.Core.Assert.

if true then
	message 100.
else
	message 101.

@Test.
procedure testProcOne:
	Assert:IsTrue(true).
end procedure.
