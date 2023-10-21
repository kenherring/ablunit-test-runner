block-level on error undo, throw.

class myClass :

	constructor myClass () :
		message "test class constructor (myClass)".
	end constructor.

	destructor myClass () :
		message "test class destructor (myClass)".
	end destructor.

	@Test.
	method public void testFail () :
	  OpenEdge.Core.Assert:Equals(1,2).
	end method.

	@Test.
	method public void testPass () :
		OpenEdge.Core.Assert:Equals(1,1).
	end method.

	@Test.
	method public void testLog () :
		log-manager:write-message("test message").
	end method.

end class
