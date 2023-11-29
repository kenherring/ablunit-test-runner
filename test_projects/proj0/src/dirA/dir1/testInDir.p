using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure test_proc :
    Assert:Equals(1,1).
end procedure.

@Test.
procedure customerTest :
  message "customerTest".
  for each customer no-lock where customer.name begins "b":
      message customer.name.
  end.
end procedure.

@Test.
procedure test3.1 :
  message 3.1.
  Assert:Equals(1,1).
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

{dirA/inc/somefile.i}
