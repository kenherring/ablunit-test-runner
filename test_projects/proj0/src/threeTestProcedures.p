

message 100.
if true then
    message 101.
else
    message 102.

@Test.
procedure CustomerFormTest :
    message 200.
    run proc1.
end procedure.
//comment

procedure notATest1:
    if true then
        message 201.
    else
        message 202.
end procedure.
//comment


@Test.

procedure CustomerViewerTest :
    if true then
        message 300.
    else
        message 301.
    run multiTestProc.p.
end procedure.
//comment
//comment

@Test (expected="Progress.Lang.OtherError").
procedure CustomerGridTest :
    message 400.
    run proc1.
    message 401.
end procedure.

//test
//comment


procedure proc1:
    message 500.
end procedure.
