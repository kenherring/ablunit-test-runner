block-level on error undo, throw.

// class destructorClass.test inherits destructorClass use-widget-pool:
class destructorSimple use-widget-pool:

    constructor destructorSimple () :
        message "under construction".
    end constructor.

    destructor destructorSimple () :
        message "ALL YOUR BASE ARE BELONG TO US".
    end destructor.

    @Test.
    method public void methodName () :
        message 100.
        OpenEdge.Core.Assert:Equals(1, 1).
    end method.

end class.
