block-level on error undo, throw.

class destructorClass.test inherits destructorClass use-widget-pool:

    @Test.
    method public void methodName () :
        OpenEdge.Core.Assert:Equals(1, method1()).
    end method.

end class.
