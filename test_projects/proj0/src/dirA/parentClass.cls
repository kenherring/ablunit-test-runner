
class dirA.parentClass :

	method protected logical testMessage () :
		log-manager:write-message("message 1").
		return true.
	end method.

	@Test.
	method public logical testMessage2 () :
		if true then
			message 100.
		else
			message 200.
	end method.

end class.
