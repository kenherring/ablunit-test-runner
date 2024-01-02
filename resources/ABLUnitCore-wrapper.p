run createDatabaseAliases.
run ABLUnitCore.p.
return.

procedure createDatabaseAliases :

    define variable aliasesSessionParam as character no-undo.
    define variable paramStart as integer no-undo.
    define variable paramEnd as integer no-undo.
    define variable dbCount as integer no-undo.
    define variable aliasCount as integer no-undo.
    define variable aliasList as character no-undo.
    define variable aliasName as character no-undo.
    define variable databaseName as character no-undo.

    assign paramStart = index(session:parameter,'ALIASES=') + 8.
    assign paramEnd = index(session:parameter,' ',paramStart).
    if paramEnd = 0 then
        paramEnd = length(session:parameter) + 1.

    assign aliasesSessionParam = substring(session:parameter, paramStart, paramEnd - paramStart).

    do dbCount = 1 to num-entries(aliasesSessionParam,';'):
        assign aliasList = entry(dbCount, aliasesSessionParam,';').
        assign databaseName = entry(1,aliasList).

        do aliasCount = 2 to num-entries(aliaslist,','):
            assign aliasName = entry(aliasCount, aliasList).
            create alias value(aliasName) for database value(databaseName).
        end.
    end.
end procedure.
