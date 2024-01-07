block-level on error undo, throw.
using OpenEdge.Core.Assert.

class dirA.parentClassTest inherits dirA.parentClass :

	@Test.
	method public logical testMethod () :
	  Assert:isTrue(testMessage()).
	end method.

	@Test.
	method public static void testMethod2 () :
	  Assert:equals(1,1).
	end method.

end class.
