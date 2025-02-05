

{include_20.i}

@Test.
procedure test_1 :
    message 100.
    if true then
        message 101.
    else
        message 102.

    run procFromInclude.
end procedure.
