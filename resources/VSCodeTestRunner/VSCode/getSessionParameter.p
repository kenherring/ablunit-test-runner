block-level on error undo, throw.

define input parameter params as character no-undo.
define input parameter name as character no-undo.
define output parameter val as character no-undo.

define variable cnt as integer no-undo.
define variable entryStr as character no-undo.

/* 
 * The 'params' input parameter is a pipe-delimited list of key-value pairs.
 * Format: "KEY1=VALUE1|KEY2=VALUE2|KEY3=VALUE3"
 * Example: "CFG=c:/path/ablunit.json|ALIASES=db1,alias1;db2,alias2"
 */
assign params = trim(trim(params, '"'), "'").

assign val = "".

do cnt = 1 to num-entries(params, '|'):
    assign entryStr = entry(cnt, params, '|').
    if entry(1, entryStr, '=') = name then
    do:
        assign val = entry(2, entryStr, '=').
        return.
    end.
end.
