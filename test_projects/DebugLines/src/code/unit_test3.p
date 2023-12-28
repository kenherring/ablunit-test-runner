message "start".

&GLOBAL-DEFINE VAR1 var1text1~~nvar1text2

@Test.
procedure testProc1:
	message 1.
	{inc/unit_inc3.i}
	message 2.
end procedure.

message "end".
