block-level on error undo, throw.
// routine-level on error undo, throw.

using OpenEdge.Core.Assert.

class DestructorError use-widget-pool:
    
    define private property DEP as DestructorErrorParent no-undo get. set.

    define public property newProp as character get:
        // if not valid-object(DEP) then
        //     DEP = new DestructorErrorParent().
        integer("abc").
        // return DEP:method1().
        return "newProp".
    end get. set.

    constructor DestructorError () :
        DEP = new DestructorErrorParent().
        // undo, throw new Progress.Lang.AppError('constructor 1').
    end constructor.
    constructor DestructorError (ipString as character) :
        // undo, throw new Progress.Lang.AppError('constructor 2').
    end constructor.

    // destructor DestructorError () :
    //     var integer iVal.
    //     message "DestructorError destructor".
    //     do stop-after 1:
    //         pause 2.
    //     end.
    //     // undo, throw new Progress.Lang.AppError('destructor error').
    //     integer("abc").
    //     // Assert:RaiseError('123').
    //     // DEP:method1().
    // end destructor.
    
    method public character method2 () :
        message "newProp=" + newProp.
        // integer("abc").
        return "method1".
    end method.

    @Test.
    method public void test1 () :
        Assert:equals(1,1).
    end method.

end class.
