message 100 "EXTERNAL SOURCE START".

if true then
    run proc1.
else
    run proc2.

message 103 "EXTERNAL SOURCE END".

procedure proc1:
    define variable cnt as integer no-undo.
    do cnt=1 to 5:
        message 'cnt=' + string(cnt).
        if cnt mod 5 = 0 then
            message 200.
        if cnt mod 7 = 0 then
            message 201.
    end.
end procedur.

procedure proc2:
    if true then
        message 300.
    else
        message 301.
end procedure.
