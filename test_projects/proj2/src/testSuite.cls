routine-level on error undo, throw.

@testsuite(classes="src.classes.testClass1,src.classes.testClass2").
@Testsuite(procedures="src/procedures/test_proc.p").


@testsuite(classes="src.classes.testClass3",
		   procedures="src/procedures/test_proc2.p").

class src.testsuite :
	constructor testsuite () :
		message "this will not execute".
	end constructor.
end class.
