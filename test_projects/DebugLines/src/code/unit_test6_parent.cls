
class code.unit_test6_parent use-widget-pool:

	constructor unit_test6_parent ():
		super().
		message "self construct!".
	end constructor.

	destructor unit_test6_parent ():
		message "self descruct!".
	end destructor.

	method public character parentProc1 () :
		message "parentProc1".
		return "proc1-result".
	end method.

	method public void parentProc2 () :
		message "parentProc2".
	end method.

end class.
