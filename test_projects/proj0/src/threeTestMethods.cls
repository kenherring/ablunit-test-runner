
CLASS threeTestMethods:

    @Test.
    METHOD PUBLIC VOID CustomerFormTest ():
        message 100.
        run multiTestProc.p.
    END METHOD.

    @Test.
    METHOD PUBLIC VOID CustomerViewerTest ():
        if true then
            message 200.
        else
            message 201.

        define variable cnt as integer no-undo.
        do cnt = 1 to 10:
            message 'cnt=' + string(cnt).
        end.

        run multiTestProc.p.
    END METHOD.

    @Test (expected="Progress.Lang.OtherError").
    METHOD PUBLIC VOID CustomerGridTest () :

        message 300.
    END METHOD.
    //comment

END CLASS.
