block-level on error undo, throw.

using OpenEdge.Core.Assert.


session:ERROR-STACK-TRACE = true.


define variable d as DestructorError.

@BeforeAll.
procedure beforeAll:
    message 10.
    
    d = new DestructorError().
    message 11.
end procedure.

@BeforeEach.
procedure beforeEach:
    message 20.
    delete object d.
    message 21.
end procedure.


@Test.
procedure test_destruct :
    define variable d as DestructorError.
    d = new DestructorError().
    // message d:method2().
    do on error undo, throw: 
        delete object d.
    end.
    message 200 error-status:error error-status:get-message(1).
    process events.
    message 201.
    catch e as Progress.Lang.Error:
        message 210.
        message e.
        undo, throw e.
    end catch.
    catch s as Progress.Lang.Stop:
        message 220.
    end catch.
    finally:
        message 230.
    end finally.
end procedure.

@Test.
procedure test_destruct2 :
    do on error undo, throw:
        define variable d as DestructorError.
        message 310.
        d = new DestructorError(). 
        message 311.
        message 312 d:newProp.
        Assert:equals(1,1).
    end.
    catch e as Progress.Lang.Error:
        message 312.
        message e.
        undo, throw e.
    end catch.
    catch s as Progress.Lang.Stop:
        message 313.
    end catch.
end procedure.

@Test.
procedure test_superError :
    define variable v as SuperError1 no-undo.
    v = new SuperError1().
end procedure.