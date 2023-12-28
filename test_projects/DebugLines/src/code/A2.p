message 100.
message 101.
message 102.

@Test.
procedure testProc2:
	message 1.

	{inc/Z.i &refval='single'}

	{inc/Z.i &refval= "double
						line"}
	message 20.
	message 21.
	if true then
	do:
		message "IS TRUE!".
	end.
	else
	do:
		message "IS FALSE!".
	end.
		{inc/Z.i &refval= "single" &refval2="second" }
	message 30.
	message 31.
		{inc/Z.i &refval= "triple
		3
						lines!"}
	message 40.
	message 41.
end procedure.


procedure testProc3:
	log-manager:write-message("test3").
	display 3.
	os-command value("ls -al").
	message 4.
	message 5.
	message 6.
	{inc/Y.i}
	message 7.
	message 8.

	message 9.

end procedure.

function testFunc1 returns character (input x as character):
	message 1.
	message 2.
	return x.
end function.

procedure testProc4:
	define input parameter xparamm  as character no-undo.
	message "4".
end procedure.


message 102.
message 999.
