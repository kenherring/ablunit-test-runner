//big include name start

define temp-table ttOne no-undo
	field field-1 as character
	field field-2 as char
	index idx-1 field-1.

for each ttOne no-lock:
	display ttOne.
end.

function getVal returns character () :
	find first ttOne
		no-lock no-error.
	return ttOne.field-2.
end function.

//big include name end.
