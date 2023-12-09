block-level on error undo, throw.
using OpenEdge.Core.Assert.

class login.test5:

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

		@Test.

	method public void testMethod4() :
	Assert:Equals(2,2).
	end method.

	@Test. method public void testMethod5 () :
		Assert:Equals(3,3).
	end method.
	@Test.
	method public void testMethod6 () :
		Assert:Equals(3,3).
	end method.
	@Test. //method public void testMethod7a () :
method public void testMethod7b () :
		Assert:Equals(3,3).
	end method.
	//@Test. //method public void testMethod8 () :
method public void NotTestMethod8 () :
		Assert:Equals(3,3).
	end method.

end class.
