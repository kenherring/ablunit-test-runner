block-level on error undo, throw.
using OpenEdge.Core.Assert.

message 'test_15.p starting'.

{include_15.i}

@Test.
procedure test_A :
    if true then
        message "in test_A".
    else
        message "this does not execute".
    Assert:isTrue(true).
end procedure.

