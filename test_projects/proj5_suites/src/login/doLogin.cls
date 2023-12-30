
class login.doLogin use-widget-pool:

	define private property userColonPass as character no-undo get. set.

	constructor doLogin () :
		super().
		userColonPass = "someUser:token".
	end constructor.

	method protected character getLoginData () :
		return entry(1,userColonPass,':').
	end method.

	method protected character getPassword () :
		return entry(2,userColonPass,':').
	end method.

end class.
