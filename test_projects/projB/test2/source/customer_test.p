block-level on error undo, throw.

@Test.
procedure procedureName :
    define variable customerCount as integer no-undo.
    run get_customer_count.p(output customerCount).
    OpenEdge.Core.Assert:Equals(1117, customerCount).
end procedure.
