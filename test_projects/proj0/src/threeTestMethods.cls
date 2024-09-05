
CLASS threeTestMethods:

    @Test.
    METHOD PUBLIC VOID CustomerFormTest ():
    END METHOD.

    @Test.
    METHOD PUBLIC VOID CustomerViewerTest ():
    END METHOD.

    @Test (expected="Progress.Lang.OtherError").
    METHOD PUBLIC VOID CustomerGridTest ():
    END METHOD.

END CLASS.
