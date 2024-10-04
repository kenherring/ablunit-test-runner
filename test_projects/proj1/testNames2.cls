using OpenEdge.Core.Assert.

class testNames2:

    @Test.
    method public void Test_testNameTest ():
        message "test 1".
    end method.

    @Test.
    method public void Test_testName# ():
        message "test 2".
    end method.

    @Test.
    method public void Test_testName#_goodValue ():
        message "test 3".
    end method.

    @Test.
    method public void Test_testName#_newValue ():
        message "test 4".
    end method.

    @Test.
    method public void Test_testName_newValue ():
        message "test 5".
    end method.

    @Test.
    method public void Test_noHashtag ():
        message "test 6".
    end method.

end class.
