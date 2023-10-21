block-level on error undo, throw.

class src.classes.testClass1 :

    @Setup.
    method public void beforeAll () :
      //Runs before each test method
      // do setup here
    end method.

    @Before.
    method public void beforeEach () :
      //Executes after each test

      // do setup here
    end method.

    @Test.
    method public void testMethod1-1 () :
        message "running testMethod1 !!".
    end method.

    @Test.
    method public void testMethod1-2 () :
        message "running testMethod1-2 !!".
    end method.

    @Test (expected="MyException").
    method public void testExceptionMethod () :
      runMethodThrowsException(). //Throws MyException
    end method.

    method public void runMethodThrowsException() :
      // undo, throw new MyException().
    end method.

    @TearDown.
    method public void afterEach () :
      //Executes after each test
      // do some cleanup here
    end method.

    @After.
    method public void afterAll () :
      //Executes after each test
    end method.

end class.
