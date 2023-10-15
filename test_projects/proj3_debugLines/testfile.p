block-level on error undo, throw.
using OpenEdge.Core.Assert.

message 100.
message 101.
message 102.

//testfile.p:8
{include1.i}
//testfile.p:10

@Test.
procedure test_proc_call :

	run local_proc.

	if true then
		message 103.
	else
		message 104.

	message "DONE".
	Openedge.Core.Assert:isTrue(false).
end procedure.

procedure local_proc :
	define variable vNum as integer init 5 no-undo.

	if vNum = 5 then
	do:
		message "message 1".
		message "message 2".
	end.
	else
	do:
		do vNum = 1 to 10:
			message "do nothing!".
		end.
	end.
	run includeproc1.
end procedure.

//testfile.p:26
