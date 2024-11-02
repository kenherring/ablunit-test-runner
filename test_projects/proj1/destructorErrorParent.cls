block-level on error undo, throw.

class DestructorErrorParent :

    destructor destructorErrorParent () :
        do on error undo, throw:
            define variable intValue as integer no-undo.
            message "destructor executing".
            intValue = integer("abc").
            undo, throw new Progress.Lang.AppError('destructor error').
        end.
    end destructor.

    method public character method1 () :
        return "method1".
    end method.

end class.
