block-level on error undo, throw.

// class destructorClass.test inherits destructorClass use-widget-pool:
class test_4.destructorSimple use-widget-pool:

    constructor destructorSimple () :
        message "under construction".
    end constructor.

    constructor destructorSimple (var1 as character) :
        message "under construction".
    end constructor.

    constructor destructorSimple (var1 as character, var2 as integer) :
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

    method public void otherMethod () :
        // This method is just a placeholder to show that the class can have other methods.
        message 'This is otherMethod!'.
    end method.

    method private void privateMethodInput(p1 as character,
                                            input p2 as integer,
                                            input-output p3 as integer,
                                            input p4 as logical,
                                            input p5 as decimal) :
    end method.

    method protected integer protectedMethodOutput(output o1 as character) :
    end method.

end class.
