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

	method public void inheritedProc () :
		if yes then
			integer("1").
		else
			integer("2").
	end method.

end class.
