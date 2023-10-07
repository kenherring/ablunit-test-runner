class MyException implements Progress.Lang.Error:

	define public property NumMessages as integer get. set.
	define public property CallStack as character init "print a call stack!" get. set.
	define public property Severity as integer init 1 get. set.

	constructor MyException() :
	end constructor.

	method public character GetMessage (msgNum as integer) :
		return "print message #" + string(msgNum).
	end method.

	method public integer GetMessageNum (msgNum as integer) :
		return 1.
	end method.

end class.
