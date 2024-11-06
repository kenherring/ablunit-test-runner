block-level on error undo, throw.

class DestructError:

    destructor DestructError () :
        message 200.
        int('abc').
        message 201.
    end destructor.

end class.