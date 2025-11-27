// Runs as a super procedure via initializationProcedure

procedure super_proc1:
    define input parameter ipInt as integer no-undo.
    define output parameter opInt as integer no-undo.
    opInt = ipInt + 1.
end procedure.
