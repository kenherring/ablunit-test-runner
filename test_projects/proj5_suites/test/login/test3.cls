block-level on error undo, throw.

class login.test3:

	@Test.
	method public void testA () :
		OpenEdge.Core.Assert:isTrue(true).
	end method.

	@Test.
	method public void testB () :
		OpenEdge.Core.Assert:isTrue(true).
	end method.

	@Test.
	method public void testC () :
		OpenEdge.Core.Assert:isTrue(true).
	end method.

end class.
