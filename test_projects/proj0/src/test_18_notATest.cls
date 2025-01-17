block-level on error undo, throw.
using OpenEdge.Core.Assert.

class test_18_notATest :

    define property propWithGet as character no-undo get:
        if true then
        do:
            message 100.
            propWithGet = 'xyz'.
        end.
        else
        do:
            message 101.
            propWithGet = 'abx'.
        end.
    end get. set.

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

    define property propOther as logical get. set.

    define property propOther2 as integer get:
        message 300.
        return 1.
    end get. set.

    define property propWithGetSet as integer no-undo get:
        message 100.
        return 99.
    end get. set (invar as integer) :
        message 200.
        propWithGetSet = invar.
    end set.

    method public void testMethod () :
    if propWithGet <> string(propWithSet) then
        assert:equals(1,1).
    end method.

end class.
