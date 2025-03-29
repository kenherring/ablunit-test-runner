block-level on error undo, throw.

class destructorClass :

    def var retVal as int no-undo.

    constructor destructorClass ():
        retVal = 2.
    end constructor.

    destructor destructorClass ():
    end destructor.

    method public int method1 () :
        return retVal.
    end method.

end class
