block-level on error undo, throw.

class src.classes.testClass3 :

	@Test.
	method public void testMethod () :
	  OpenEdge.Core.Assert:Equals(1,2).
	end method.

end class
