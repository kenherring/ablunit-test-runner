message "start".

@Test.
procedure testProc1:
	message 1.
	{inc/unit_inc1.i &refval="singleline"}
	message 2.
end procedure.

message "end".
