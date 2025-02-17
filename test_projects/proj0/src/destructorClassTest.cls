block-level on error undo, throw.

class destructorClassTest use-widget-pool:

    @Test.
    method public void methodName () :
        define variable dc as destructorClass no-undo.
        dc = new destructorClass().
        message 100.
        OpenEdge.Core.Assert:Equals(2, dc:method1()).
    end method.

end class.
