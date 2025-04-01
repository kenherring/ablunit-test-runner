using OpenEdge.Core.Assert.
block-level on error undo, throw.

class dirA.dir1.testClassInDir:

  @Test.
  method public void test22_1 ():
    message 22.1.
    if true then
      Assert:Equals(1,1).
    else
      Assert:Equals(1,2).
  end method.

  @Test.
  method public void test22_2 () :
    message 3.2.
    Assert:Equals(1,1).
  end method.

  method public void not_a_test4 () :
    message 4.
  end method.
end class
