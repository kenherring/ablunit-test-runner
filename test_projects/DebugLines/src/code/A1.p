
message "start".

define variable cnt as integer no-undo.


@Test.
procedure testProc1:
	message 1.
	{inc/Z.i &refval="singleline"}
	message 2.
	{inc/Y.i}
	message 3.
end procedure.

message "out of block include-X".
{inc/X.i}
message "out of block include-X".


procedure anotherProc :
	message 200.
end procedure.

function testFuncWithInclude returns integer ().
	message "in testFuncWithInclude".
	{inc/Z.i &refval="singleline2"}
	message "out of block include-2".
	return 100.
end function.

message "end".

{inc/funcs.i}

function endFunc returns integer () :
	return 1.
end function
