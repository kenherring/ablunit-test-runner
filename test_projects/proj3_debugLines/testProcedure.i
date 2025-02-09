
define temp-table ttTable no-undo
  field field_1 as character
  index idx-1 field_1.

@Test.
procedure testProcedure_{1} :
  run doSomething.
  Assert:Equals(1,1).
end procedure.
