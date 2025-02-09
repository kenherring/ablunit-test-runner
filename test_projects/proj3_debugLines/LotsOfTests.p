using OpenEdge.Core.Assert.

{doSomething.i}

@Test.
procedure testProcedure0 :
  run doSomething.
  Assert:Equals(1,1).
end procedure.

{testProcedure.i 1}
// {testProcedure.i 2}
// {testProcedure.i 3}
// {testProcedure.i 4}
// {testProcedure.i 5}
// {testProcedure.i 6}
// {testProcedure.i 7}
// {testProcedure.i 8}
// {testProcedure.i 9}
// {testProcedure.i 10}
