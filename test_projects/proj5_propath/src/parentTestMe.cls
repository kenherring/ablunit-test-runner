using OpenEdge.Core.Assert.
block-level on error undo, throw.

class parentTestMe :

	@Test.
	method public void parentTestPass () :
	  Assert:Equals(1,1).
	end method.

	@Test.
	method public void parentTestFail () :
	  Assert:Equals(1,1).
	end method.

end class
