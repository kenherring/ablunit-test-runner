using OpenEdge.Core.Assert.

{doSomething.i}

@Test.
procedure testProcedure0 :
  run doSomething.
  Assert:Equals(1,1).
end procedure.

{include6.i 1}
// {include6.i 2}
// {include6.i 3}
// {include6.i 4}
// {include6.i 5}
// {include6.i 6}
// {include6.i 7}
// {include6.i 8}
// {include6.i 9}
// {testProcedure.i 10}
