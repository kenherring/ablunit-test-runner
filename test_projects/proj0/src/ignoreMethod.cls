
class ignoreMethod:

    @Test.
    method public void NotSkippedTest ():
        message 'PROPATH=' + propath.
        message 'ABLUnitCore.p=' + search('ABLUnitCore').
    end method.

    @Test. @Ignore.
    method public void SkippedTest ():
    end method.

    @Test.
    @Ignore.
    method public void SkippedTest2 ():
    end method.

    @Test.
    @Ignore .
    method public void SkippedTest3 ():
    end method.

    // Not a test case
    @Ignore.
    method public void SkippedTest4 ():
    end method.

    @Ignore  .
    @Test.
    method public void SkippedTest5 ():
    end method.

end class.
