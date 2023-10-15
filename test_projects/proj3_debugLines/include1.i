//include1.i#1
message 401.

procedure includeproc1 :
	if false then
		message 200.
	else
		message 201.
	Openedge.Core.Assert:isTrue(false).
	// {
	// 	include2.i
	// }
	message 300.
	
end procedure.

message 499.

//include1.i#17