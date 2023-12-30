block-level on error undo, throw.
using OpenEdge.Core.Assert.

class src.cache.testCache :

	@Test.
	method public void testMethod () :
	  Assert:Equals(2,2).
	  pause .250.
	end method.

	@Test.
	method public void testMethod2 () :
	  Assert:Equals(2,2).
	  pause 1.
	end method.

	@Test.
	method public void testMethod4 () :
	  Assert:Equals(2,2).
	  pause .1.
	end method.

	@Test.
	method public void testMethod3 () :
	  Assert:Equals(1,2).
	  pause .500.
	end method.

	@Test.
	method public void testMethod5 () :
	  Assert:Equals(2,2).
	  pause 2.
	end method.

end class.
