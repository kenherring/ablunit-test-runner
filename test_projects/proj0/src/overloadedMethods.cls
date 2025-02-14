block-level on error undo, throw.

class overloadedMethods :

    {externalMethod.i}

    method public void overloadMethod (var1 as character) :
        message 100 var1.
    end method.

    method public void otherMethod () :
        message 200.
        message 202.
    end method.

    method public void overloadMethod (var1 as character, var2 as character) :
        message 101 var1 var2.
        if true then
            message 'true!'.
        else
            message 'false'.
        message 102 var1 var2. // test comment
    end method.

    method public void overloadMethod (var1 as integer, var2 as character, var3 as decimal) :
        message 103 var1 var2 var3.
    end method.

@Test.
method public void methodName () :
 overloadMethod('a', 'b').
OpenEdge.Core.Assert:IsTrue(yes).
end method. // end method

    @Test.
    method public void methodName2 () :
        overloadMethod('a', 'b').
        message string(overloadedTwice()).
        external2().
        OpenEdge.Core.Assert:IsTrue(yes).
        alsoNotOverloaded(1,2).
    end method.

    method public integer overloadedTwice () :
        return 1.
    end.

    method public integer notOverloaded () :
    end method.

    method public integer overloadedTwice(c as char) :
        return 2.
    end.

    method public integer alsoNotOverloaded(
        var1 as integer,
        var2 as integer
    ):
        message 'not overloaded!'.
        if true then
            message 'var1=' var1.
        else
            message 'var2=' var2.
        return 999.
    end method.

end class.
