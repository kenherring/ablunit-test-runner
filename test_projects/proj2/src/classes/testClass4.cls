block-level on error undo, throw.
using src.MyException.
using OpenEdge.Core.Assert.

class src.classes.testClass4:

    @Test.
    method public void testMethod () :
      Assert:Equals(1,1).
    end method.

    // TODO - need to test with 12.5+
    // https://community.progress.com/s/article/ablunit-does-not-fail-when-should-with-test-expected-progress-lang-apperror
    @Test (expected="MyException").
    method public void testExceptionMethod () :
      runMethodThrowsException(). //Throws MyException
    end method.

    method public void runMethodThrowsException () :
      undo, throw new MyException().
    end method.


end class.
