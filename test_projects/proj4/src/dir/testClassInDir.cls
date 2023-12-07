block-level on error undo, throw.
using OpenEdge.Core.Assert.

class src.dir.testClassInDir use-widget-pool :

	@Test.
	method public void testMethod () :
	  Assert:Equals(1,1).
	end method.

end.
