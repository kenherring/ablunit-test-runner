block-level on error undo, throw.
using OpenEdge.Core.Assert.

class test_18B :

    @Test.
    method public void testMethod () :
        define variable x as test_18_notATest no-undo.
        x = new test_18_notATest().
        if true then
            assert:equals(2,2).
        else
            assert:equals(1,2).
        message 'done'.
    end method.

end class.
