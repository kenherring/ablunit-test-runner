using OpenEdge.Core.Assert.
block-level on error undo, throw.

class classTest:
    @test.
    method public void testMethodOne ():
        //nothing here - always pass
    end method.

    @TEST.
    method public void testMethodTwo(): //TODO - fix name
        //nothing here - always pass
    end method.
end class.