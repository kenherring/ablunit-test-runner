// Import a UTF-8 files

define stream iStream.

@Test.
procedure import_utf8_file :
    define variable iRow as character no-undo.
    define variable lineNum as integer no-undo.
    input stream iStream from ./import_charset.txt.
    repeat:
        import stream iStream unformatted iRow.
        lineNum = lineNum + 1.
        message string(lineNum) + ':\t' + iRow.
    end.
    input stream iStream close.
end procedure.

@Test.
procedure char_with_charset :
    define variable testVar as character no-undo.
    testVar = "gold star: ⭐".
    message "testVar: " + testVar.
end procedure.
