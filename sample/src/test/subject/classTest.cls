using OpenEdge.Core.Assert.
block-level on error undo, throw.

class subject.classTest inherits subject.class :

    @Test.
    method public void testMethod1 () :
        Assert:equals("one","one").
    end method.

    @test.
    method public void testMethod2 () :
        Assert:IsTrue(methodOne()).
    end method.

    @Test.
    method public void testMethod3 () :
        Assert:IsTrue(false).
    end method.

    @Test.
    method public void testMethod4 () :
        message "error:" + string(integer("123a")).
    end method.

end class.