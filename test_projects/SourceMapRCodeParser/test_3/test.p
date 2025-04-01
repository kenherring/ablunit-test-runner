using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure test_proc :
    Assert:Equals(1,1).
end procedure.

@Test.
procedure test3.1 :
  message 3.1.
  if true then
    Assert:Equals(1,1).
  else
    Assert:Equals(1,2).
end procedure.

@Test.
procedure test3.2 :
  message 3.2.
  Assert:Equals(1,1).
end procedure.

@Test.
procedure test4 :
  message 4.
  Assert:Equals(2,2).
end procedure.

procedure NotATest :
  define input parameter p1 as character no-undo.
  message "THIS IS NOT A TEST PROCEDURE".
end procedure.
