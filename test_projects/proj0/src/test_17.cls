block-level on error undo, throw.
using OpenEdge.Core.Assert.

class test_17 :

    define property propWithGet as character no-undo get:
        if true then
        do:
            message 100.
            define variable cnt as integer no-undo.
            do cnt = 1 to 10:
                message 200.
            end.
            propWithGet = 'xyz'.
        end.
        else
        do:
            message 101.
            propWithGet = 'abx'.
        end.
    end get. set.

    constructor test_17 () :
    end constructor.

    define property propWithSet as integer no-undo get. set (invar as integer) :
        if false then
        do:
            message 200.
            propWithSet = 1.
        end.
        else
        do:
            message 201.
            propWithSet = -2.
        end.
    end set.

    @Test.
    method public void testMethod () :
        propWithSet = 1.
        if propWithGet <> string(propWithSet) then
            assert:equals(1,1).
    end method.

end class.
