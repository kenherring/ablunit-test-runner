using OpenEdge.Core.Assert.

@Test.
procedure Test_testNameTest:
    message "test 1".
end procedure.

@Test.
procedure Test_testName#:
    message "test 2".
end procedure.

@Test.
procedure Test_testName#_goodValue:
    message "test 3".
end procedure.

@Test.
procedure Test_testName#_newValue:
    message "test 4".
end procedure.

@Test.
procedure Test_testName_newValue:
    message "test 5".
end procedure.

@Test.
procedure Test_noHashtag:
    message "test 6".
end procedure.
