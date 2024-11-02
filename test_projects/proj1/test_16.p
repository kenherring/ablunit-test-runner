block-level on error undo, throw.
using OpenEdge.Core.Assert.
session:ERROR-STACK-TRACE = true.


define variable d as DestructError no-undo.

@BeforeEach.
procedure beforeEach:
    message 100
    d = new DestructError().
    message 101.
    delete object d.
    message 102.
end procedure.


@Test.
procedure test_superError :
    define variable v as SuperError1 no-undo.
    message 200.
    v = new SuperError1().
    message 201.
end procedure.
