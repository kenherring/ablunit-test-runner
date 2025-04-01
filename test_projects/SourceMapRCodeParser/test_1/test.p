// TEST CASE: no trailing lines
block-level on error undo, throw.
using OpenEdge.Core.Assert.

message program-name(1) + 'starting'.
{test_1/include.i}

@Test.
procedure test_A :
        if true then
        message "in test_A".
        else
        message "this does not execute".
        Assert:isTrue(true).
end procedure.
