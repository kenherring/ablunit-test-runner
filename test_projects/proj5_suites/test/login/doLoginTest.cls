using OpenEdge.Core.Assert.
block-level on error undo, throw.

class login.doLoginTest inherits login.doLogin use-widget-pool:

	@Test.
	method public void testLogin() :
		Assert:equals(getLoginData(),"testuser").
	end method.

end class.
