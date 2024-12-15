using OpenEdge.Core.Assert.

block-level on error undo, throw.

@Test.
procedure CustomerFormTest :
    message 100.
end procedure.

@Test.
procedure CustomerViewerTest :
    message 200.
end procedure.

@Test.
procedure failTest :
    message 300.
    Assert:equals(1, 2).
end procedure.

@Test (expected="Progress.Lang.OtherError").
procedure CustomerGridTest :
    message 400.
end procedure.
