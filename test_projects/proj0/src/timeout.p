block-level on error undo, throw.

using OpenEdge.Core.Assert.

@BeforeEach.
procedure beforeAll :
  message "301 beforeAll".
end procedure
.
@BeforeEach.
procedure beforeEach :
  message "302 beforeEach".
end procedure.

@Test.
procedure timeout_1 :
    message "pausing 1 second".
    pause 1.
    message "pause complete".
    Assert:isTrue(true).
end procedure.

@Test.
procedure fail_1 :
    Assert:isTrue(false).
end procedure.

@Test.
procedure timeout_5 :
    message "pausing 5 seconds (" + string(time, "hh:mm:ss") + ")".
    pause 5.
    message "pause complete (" + string(time, "hh:mm:ss") + ")".
    Assert:isTrue(true).
end procedure.

@Test.
procedure timeout_2 :
    message "pausing 2 seconds (" + string(time, "hh:mm:ss") + ")".
    pause 2.
    message "pause complete (" + string(time, "hh:mm:ss") + ")".
    Assert:isTrue(true).
end procedure.

@Test.
procedure timeout_29 :
    message "pausing 29 seconds (" + string(time, "hh:mm:ss") + ")".
    pause 29.
    message "pause complete (" + string(time, "hh:mm:ss") + ")".
    Assert:isTrue(true).
end procedure.

@Test.
procedure timeout_31 :
    message "pausing 31 seconds (" + string(time, "hh:mm:ss") + ")".
    pause 31.
    message "pause complete (" + string(time, "hh:mm:ss") + ")".
    Assert:isTrue(true).
end procedure.

@Test.
procedure timeout_45 :
    message "pausing 45 seconds (" + string(time, "hh:mm:ss") + ")".
    pause 45.
    message "pause complete (" + string(time, "hh:mm:ss") + ")".
    Assert:isTrue(true).
end procedure.
