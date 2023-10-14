block-level on error undo, throw.
   
@Test.
procedure testProcedure :
  if true then
    message "TRUE!".
  else 
    message "FALSE!".

  define variable cnt as integer no-undo.
  do cnt = 1 to 5:
    message cnt.
    if cnt mod 10 = 0 then
      message "MOD 10!".
  end.
  OpenEdge.Core.Assert:isTrue(yes).
end procedure.






