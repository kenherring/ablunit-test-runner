using OpenEdge.Core.Assert.
block-level on error undo, throw.

class login.doLoginTest inherits login.doLogin use-widget-pool:

	@Test.
	method public void testLogin() :
		Assert:equals("someUser",getLoginData()).
	end method.

end class.
