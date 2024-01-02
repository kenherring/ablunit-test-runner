using OpenEdge.Core.Assert.
block-level on error undo, throw.

@Test.
procedure test_proc :
    Assert:Equals(1,1).
end procedure.

@Test.
procedure dbAliasTest1 :
  message "customerTest".
  for first dbalias.customer no-lock where dbalias.customer.name begins "b":
      message dbalias.customer.name.
  end.
end procedure.

@Test.
procedure dbAliasTest2 :
  message "customerTest".
  for last third.customer no-lock where third.customer.name begins "b":
      message third.customer.name.
  end.
end procedure.
