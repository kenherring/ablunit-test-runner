message "start".

@Test.
procedure testProc1:
	message 1.
	{inc/unit_inc1.i &refval="double
	line"}
	message 2.

end procedure.




procedure other_proc_1 :
	message 1.
end procedure.
procedure other_proc_2 :
	message 1.
end procedure.
procedure other_proc_3 :
	message 1.
end procedure.
procedure other_proc_4 :
	message 1.
end procedure.
procedure other_proc_5 :
	message 1.
end procedure.
{inc/include_7.i}
procedure other_proc_6 :
	message 1.
end procedure.
procedure other_proc_7 :
	message 1.
end procedure.
procedure other_proc_8 :
	message 1.
end procedure.
procedure other_proc_9 :
	message 1.
end procedure.
procedure other_proc_10 :
	message 1.
end procedure.
procedure other_proc_11:
	message 1.
end procedure.
procedure other_proc_12 :


	if true then do:
		if false then do:



			message 200.
		end.
	end.

	message 1.

	def var i as integer no-undo.
	do i=0 to 10:
		message i.

	end.



end procedure.
procedure other_proc_13 :
	message 1.
end procedure.
procedure other_proc_14 :
	message 1.
end procedure.
procedure other_proc_15 :
	message 1.
end procedure.
procedure other_proc_16 :
	message 1.
end procedure.
procedure other_proc_17 :
	message 1.
end procedure.
procedure other_proc_18 :
	message 1.
end procedure.
procedure other_proc_19 :
	message 1.
end procedure.
procedure other_proc_20 :
	message 1.
end procedure.

message "end".
