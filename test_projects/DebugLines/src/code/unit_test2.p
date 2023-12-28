message "start".

@Test.
procedure testProc1:
	message 1.
	{inc/unit_inc1.i &refval="double
	line"}
	message 2.
end procedure.

message "end".
