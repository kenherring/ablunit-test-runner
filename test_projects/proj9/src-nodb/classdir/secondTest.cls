block-level on error undo, throw.
using OpenEdge.Core.Assert.

class classdir.secondTest :

   @Test.
   method public void testMethod () :
     Assert:Equals(1,1).
   end method.

end class.
