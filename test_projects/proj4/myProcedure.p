block-level on error undo, throw.

@Test.
procedure testProcedure :
  profiler:user-data("test message").
  profiler:user-data("test message - this is a second message that has a quote character").
  OpenEdge.Core.Assert:isTrue(yes).
  if false then
    OpenEdge.Core.Assert:isTrue(no).
end procedure.

@Test.
procedure testProcedure1 :
  OpenEdge.Core.Assert:isTrue(no).
end procedure.
