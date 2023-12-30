class code.unit_test5:

	method public void test_method_one () :
		message 100.
	end method.

	method public void test_method_two () :
		message 200.
		{inc/unit_inc5.i &refval="test_method_two"}
		message 201.
	end method.

end class.
