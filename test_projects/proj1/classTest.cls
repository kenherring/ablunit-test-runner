using OpenEdge.Core.Assert.
block-level on error undo, throw.

class classTest:
    @test.
    method public void testMethodOne ():
        //nothing here - always pass
        message 'this is a message from classTest:TestMethodOne()'.
    end method.

    @TEST.
    method void testMethodTwo():
        //nothing here - always pass
        Assert:equals(1,1).
    end method.
end class.
