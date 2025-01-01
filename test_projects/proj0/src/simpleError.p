block-level on error undo, throw.

@Test.
procedure simple-pass-proc :
end procedure.

@Test.
procedure simple-error-proc :
    OpenEdge.Core.Assert:Equals(1,2).
end procedure.
