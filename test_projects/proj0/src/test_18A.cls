block-level on error undo, throw.
using OpenEdge.Core.Assert.

class test_18A :

    @Test.
    method public void testMethod () :
        define variable x as test_18_notATest no-undo.
        x = new test_18_notATest().
        message 100 x:propWithGet x:propWithSet.
        assert:equals(1,1).
    end method.

end class.
