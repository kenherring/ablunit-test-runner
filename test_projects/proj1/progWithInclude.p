
message "start the program".

//start include
/* linestart */ {someInclude.i} /*middle*/ {someInclude2.i} /*lineend*/
//end include

run commonProc.

if true then
	message 200.
else
	message 300.

message "LAST LINE".
