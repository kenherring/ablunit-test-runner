block-level on error undo, throw.
using OpenEdge.Core.Assert.

@Test.
procedure testProcedureName1 :
  Assert:Equals(1,1).
  pause 1.
end procedure.

@Test.
procedure testProcedureName2 :
  Assert:Equals(2,2).
  pause 1.
end procedure.

@Test.
procedure testProcedureName3 :
  Assert:Equals(3,3).
  pause 1.
end procedure.

@Test.
procedure testProcedureName4 :
  Assert:Equals(4,4).
  pause 1.
end procedure.




		@Test.

procedure testProc5 :
	Assert:Equals(2,2).
  pause 1.
end procedure.

@Test. procedure testProc6:
  Assert:Equals(2,2).
  pause 1.
end procedure.

@Test. //procedure testProc7:
procedure testProc7:
  Assert:Equals(2,2).
  pause 1.
end procedure.
	//@Test. //procedure testProc8:
    procedure testProc9 :
      Assert:Equals(9,9).
      pause 1.
    end procedure.

/* @Test. */
procedure testProc10 :
  Assert:Equals(10,10).
  pause 1.
end procedure.

@Test. /* procedure testProc11 : */
procedure testProc12 :
  Assert:Equals(11,11).
  pause 1.
end procedure.

@Test.
pROCeDUre /* comment */ testProc13 :
  Assert:Equals(13,13).
  pause 1.
end procedure.
