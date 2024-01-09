block-level on error undo, throw.
using OpenEdge.Core.Assert.

class test.testClass1Test inherits src.testClass1 :

    @Test.
    method public void testMethod () :
      Assert:Equals("returnValue",getRetVal()).
    end method.

end class.
