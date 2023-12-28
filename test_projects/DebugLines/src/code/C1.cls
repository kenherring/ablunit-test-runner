using OpenEdge.Core.Assert.

class code.C1:

	constructor C1 () :
		message 100.
	end constructor.

	destructor C1 () :
		message 200.
	end destructor.

	method public void m1 () :
		message 300.
		{inc/Y.i}
		message 301.
	end method.

	method public void m2 () :
	end method.

	//method public void m3 () :
	//end method.

	@Test.
	method public void testMethod () :
	  Assert:Equals(1,2).
	end method.

end class
