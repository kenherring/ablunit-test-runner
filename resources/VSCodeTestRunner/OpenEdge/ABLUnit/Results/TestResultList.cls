block-level on error undo, throw.

using OpenEdge.Core.Collections.Array.
using Progress.Lang.Object.


class OpenEdge.ABLUnit.Results.TestResultList inherits Array:
    /* Default constructor */
    constructor public TestResultList (  ):
        super ().
        this-object:AutoExpand = true.
    end constructor.

    method override public logical Add(input pIndex as integer, input pElement as Object ):
        // The backing of this collection is an Array, which allows null items, rather than
        // a List, which does not. So we act like a List here
        if not valid-object(pElement) then
            return false.

        message "pElement=" + string(pElement) + ', pIndex=' + string(pIndex).

        run VSCodeWriteProfiler.p(pElement).
        return super:Add(pIndex, pElement).
    end method.

    method override public logical Add(input pElement as Object):
        // The backing of this collection is an Array, which allows null items, rather than
        // a List, which does not. So we act like a List here
        if not valid-object(pElement) then
            return false.

        message "pElement=" + string(pElement).

        run VSCodeWriteProfiler.p(pElement).
        return super:Add(pElement).
    end method.

end class.
