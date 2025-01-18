

if true then
    message 900.
else
    message 901.

define variable cnt as integer.
do cnt = 1 to 5:
    message 902.
    if cnt mod 3 = 0 then
        message 903.
    else if cnt mod 7 = 0 then
        message 904. // not executed
end.
