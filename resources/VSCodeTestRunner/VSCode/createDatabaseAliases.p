define input parameter VERBOSE as logical no-undo.
define input parameter sessionParam as character no-undo.

define variable aliasesSessionParam as character no-undo.
define variable dbCount as integer no-undo.
define variable aliasCount as integer no-undo.
define variable aliasList as character no-undo.
define variable aliasName as character no-undo.
define variable databaseName as character no-undo.

if VERBOSE then message 'START createDatabaseAliases'.

run VSCode/getSessionParameter.p(sessionParam, 'ALIASES', output aliasesSessionParam).

if aliasesSessionParam = '' or aliasesSessionParam = ? then
do:
    if VERBOSE then message 'END createDatabaseAliases - no ALIASES in session:parameter'.
    return.
end.

do dbCount = 1 to num-entries(aliasesSessionParam, ';'):
    assign aliasList = entry(dbCount, aliasesSessionParam, ';').
    assign databaseName = entry(1, aliasList).

    do aliasCount = 2 to num-entries(aliasList, ','):
        assign aliasName = entry(aliasCount, aliasList).
        create alias value(aliasName) for database value(databaseName).
    end.
end.
if VERBOSE then message 'END createDatabaseAliases'.
