using OpenEdge.Core.Assert.
using code.*.

class code.unit_test6_child inherits unit_test6_parent use-widget-pool:

	constructor unit_test6_child ():
		super().
		message "construct unit_test6".
	end constructor.

	destructor unit_test6_child ():
		message "destruct unit_test6".
	end destructor.

	@Test.
	method public void testMethod1 () :
		if true then
			Assert:Equals(2,2).
		else
			Assert:Equals(1,2).
	end method.

	@Test.
	method public void testParentProc1 () :
		define variable result as character no-undo.
		result = parentProc1().
		Assert:Equals("proc1-result", result).
	end method.

end class.
