using OpenEdge.Core.Assert.
block-level on error undo, throw.

class testMe inherits parentTestMe:

	@Test.
	method public void testMethodPass () :
		message 100.
		OpenEdge.Core.Assert:Equals(1,1).
		message 101.
	end method.

	@Test.
	method public void testMethodCallAndFail () :
		message 200.

		if true then
			message 203.
		else
			message 204.

		inheritedProc().

		Assert:Equals(1,2).
		message 201.
		run callMe.p.
		message 202.
	end method.

end class.
