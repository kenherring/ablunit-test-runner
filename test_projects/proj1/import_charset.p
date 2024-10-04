block-level on error undo, throw.

define stream iStream.
define stream oStream.

@Test.
procedure char_with_charset :
    define variable testVar as character no-undo.
    testVar = "gold star: ⭐".
    message "testVar: " + testVar.
end procedure.

@Test.
procedure euro_symbol_out_and_in :
    define variable testVar as character no-undo.
    define variable impVal as character no-undo.

    message "session:cpinternal=" + session:cpinternal.
    message "session:cpstream=" + session:cpstream.

    testVar = "euro symbol: €".

    output stream oStream to "./import_charset.out".
    put stream oStream unformatted testVar.
    output stream oStream close.

    input stream iStream from "./import_charset.out".
    import stream iStream unformatted impVal.
    input stream iStream close.

    message "testVar:  " + testVar.
    message "impVal:   " + impVal.
    message "index:    " + string(index(testVar,'?')).
    message "index:    " + string(index(impVal,'?')).

    OpenEdge.Core.Assert:equals(testVar, impVal).
    OpenEdge.Core.Assert:equals(index(testVar,'?'),0).
    OpenEdge.Core.Assert:equals(index(impVal,'?'),0).
end procedure.

@Test.
procedure euro_symbol_in :
    define variable testVar as character initial "euro symbol: €" no-undo.
    define variable impVal as character no-undo.

    message "session:cpinternal=" + session:cpinternal.
    message "session:cpstream=" + session:cpstream.

    input stream iStream from "./import_charset.in".
    import stream iStream unformatted impVal.
    input stream iStream close.

    message "testVar:  " + testVar.
    message "impVal:   " + impVal.
    message "index:    " + string(index(testVar,'?')).
    message "index:    " + string(index(impVal,'?')).

    OpenEdge.Core.Assert:equals(testVar, impVal).
    OpenEdge.Core.Assert:equals(index(testVar,'?'),0).
    OpenEdge.Core.Assert:equals(index(impVal,'?'),0).
end procedure.

@Test.
procedure has_y_parameter:
    message 'session:startup-parameters=' + session:startup-parameters.
    message 'lookup: ' + string(lookup('-y', session:startup-parameters)) + ', ' + string(lookup('-yx', session:startup-parameters)).
    message 'index: ' + string(index(session:startup-parameters, '-y')) + ', ' + string(index(session:startup-parameters, '-yx')).
    OpenEdge.Core.Assert:equals(lookup('-y', session:startup-parameters),0).
    OpenEdge.Core.Assert:equals(lookup('-yx', session:startup-parameters),0).
end procedure.
