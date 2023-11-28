block-level on error undo, throw.
using OpenEdge.Core.Assert.

class login2.test6:

	@Test.
	method public void testA () :
		Assert:isTrue(true).
	end method.

	@Test.
	method public void testB () :
		Assert:isTrue(true).
	end method.

	@Test.
	method public void testC () :
		Assert:isTrue(true).
	end method.

end class.
